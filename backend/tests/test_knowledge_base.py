"""Knowledge base selection and prompt assembly."""

import pytest

from app.services import knowledge_base as kb
from app.services.ai_service import BASE_PROMPT, build_system_prompt


def _msg(text: str, role: str = "user") -> dict:
    return {"role": role, "content": text}


class TestDetection:
    def test_greeting_selects_nothing(self):
        assert kb.detect_topics([_msg("你好")]) == []

    def test_architecture_question(self):
        assert "architecture" in kb.detect_topics([_msg("帮我看看这个拓扑合不合理")])

    def test_openclash_question(self):
        assert "openclash" in kb.detect_topics([_msg("OpenClash 的 Fake-IP 模式怎么选")])

    def test_adguard_question(self):
        assert "adguard" in kb.detect_topics([_msg("AdGuard Home 怎么配上游 DNS")])

    def test_stability_question(self):
        assert "stability" in kb.detect_topics([_msg("路由器老是断网怎么办")])

    def test_cross_topic_marks_both_component_topics(self):
        topics = kb.detect_topics([_msg("AdGuard 和 OpenClash 一起用，DNS 怎么串")])
        assert {"adguard", "openclash"} <= set(topics)

    def test_cross_topic_is_recognised(self):
        assert kb.is_dns_cross_topic(["adguard", "openclash"]) is True
        assert kb.is_dns_cross_topic(["adguard"]) is False
        assert kb.is_dns_cross_topic(["openwrt", "stability"]) is False

    def test_only_recent_user_turns_are_scanned(self):
        history = [
            _msg("先问个 OpenClash 的问题"),
            {"role": "assistant", "content": "好的"},
            _msg("现在聊聊拓扑"),
            _msg("继续"),
            _msg("还有"),
            _msg("再说"),
            _msg("最后问一个 VLAN 的问题"),
        ]
        # The early OpenClash mention is outside the recent window.
        assert "openclash" not in kb.detect_topics(history)

    def test_empty_conversation(self):
        assert kb.detect_topics([]) == []


class TestLoading:
    def test_core_file_exists_and_is_small(self):
        core = kb.load_core()
        assert core, "00_Core_Constraints.md should be present"
        # The whole point of the split: the always-on part must stay small.
        assert len(core) < 3000, f"core grew to {len(core)} chars"

    def test_every_topic_file_loads(self):
        for topic in kb.TOPIC_FILES:
            content = kb.load_topics([topic])[topic]
            assert content, f"{topic} document is empty"

    def test_unknown_topic_is_ignored(self):
        assert kb.load_topics(["nope"]) == {}

    def test_section_without_topics_contains_only_core(self):
        section = kb.build_knowledge_section([])
        assert "TOPIC:" not in section
        assert len(section) == len(kb.load_core())


class TestPromptSize:
    """The regression guard for the 79%-of-prompt problem."""

    @staticmethod
    def _full_kb_size() -> int:
        return len(kb.load_core()) + sum(
            len(c) for c in kb.load_topics(kb.TOPIC_FILES).values()
        )

    def test_greeting_prompt_is_much_smaller_than_full_kb(self):
        prompt = build_system_prompt([_msg("你好")])
        assert len(prompt) < self._full_kb_size() * 0.5, (
            "a greeting should not carry the whole knowledge base"
        )

    def test_single_topic_prompt_is_smaller_than_full_kb(self):
        prompt = build_system_prompt([_msg("OpenClash 怎么配")])
        assert len(prompt) < self._full_kb_size() * 0.8

    def test_focused_prompt_beats_previous_full_injection(self):
        """Old behaviour injected ~12.4k chars of KB into every request."""
        greeting = build_system_prompt([_msg("你好")])
        # BASE_PROMPT itself is a few thousand chars; only the KB part matters.
        kb_part = len(greeting) - len(BASE_PROMPT)
        assert kb_part < 3000, f"core knowledge block is {kb_part} chars"

    def test_topic_prompt_actually_contains_the_document(self):
        prompt = build_system_prompt([_msg("OpenClash 的 DNS 劫持怎么设置")])
        assert "OpenClash" in prompt
        assert "拦截" in prompt or "策略组" in prompt or "Fake-IP" in prompt

    def test_greeting_does_not_include_topic_documents(self):
        prompt = build_system_prompt([_msg("你好")])
        # A distinctive phrase from the OpenClash install/usage doc
        assert "策略组" not in prompt


class TestInstallerStepsRemoved:
    """Installation steps are generic knowledge and version-fragile."""

    def test_openclash_doc_drops_opkg_install_list(self):
        doc = kb.load_topics(["openclash"])["openclash"]
        assert "opkg install luci" not in doc
        assert "luci-compat" not in doc

    def test_adguard_doc_drops_docker_install(self):
        doc = kb.load_topics(["adguard"])["adguard"]
        assert "docker run" not in doc
        assert "install.sh" not in doc

    def test_retained_content_is_still_substantial(self):
        doc = kb.load_topics(["openclash"])["openclash"]
        assert len(doc) > 1500, "removal should not gut the document"


class TestCrossTopicEconomy:
    """Combining DNS components must not pull the full OpenWRT document."""

    def test_cross_topic_uses_interop_extract_not_full_openwrt(self):
        section = kb.build_knowledge_section(["adguard", "openclash"])
        assert kb.DNS_INTEROP_FILE in section
        # The bulky interface/firewall chapters must stay out. Match on
        # headings unique to 02_OpenWRT_Basic.md, not on loose words that the
        # always-on core file also happens to contain.
        assert "/etc/config/network" not in section
        assert "防火墙与端口转发 (Firewall)" not in section
        assert "系统维护与故障排查" not in section

    def test_cross_topic_smaller_than_naive_trio(self):
        cross = kb.build_knowledge_section(["adguard", "openclash"])
        naive = kb.build_knowledge_section(["adguard", "openclash", "openwrt"])
        assert len(cross) < len(naive)

    def test_interop_file_keeps_the_actionable_part(self):
        interop = kb.load_topics  # noqa: F841  (keep import used)
        from app.services.knowledge_base import _read

        doc = _read(kb.DNS_INTEROP_FILE)
        assert "5353" in doc
        assert "dhcp_option" in doc


class TestPromptBudget:
    """Hard ceilings so the prompt cannot creep back up unnoticed."""

    MAX_CORE_KB = 3000

    @pytest.mark.parametrize(
        "text",
        ["你好", "这个拓扑合理吗", "路由器老是断网", "OpenClash 的 Fake-IP 怎么选"],
    )
    def test_kb_block_stays_under_budget(self, text):
        prompt = build_system_prompt([_msg(text)])
        kb_chars = len(prompt) - len(BASE_PROMPT)
        assert kb_chars < self.MAX_CORE_KB + 4000, f"{text}: {kb_chars} chars"

    def test_greeting_is_the_cheapest_case(self):
        greeting = len(build_system_prompt([_msg("你好")]))
        topic = len(build_system_prompt([_msg("OpenClash 怎么配")]))
        assert greeting < topic

    def test_base_prompt_stays_compact(self):
        # It is paid on every request; growing it defeats the whole split.
        assert len(BASE_PROMPT) < 1500, f"BASE_PROMPT is {len(BASE_PROMPT)} chars"


class TestMeasuredSavings:
    """Pin the actual measured prompt sizes so regressions are visible."""

    # Scenarios that cover the documented usage patterns.
    CASES = {
        "greeting": "你好",
        "port_conflict": "我 AdGuard Home 和 dnsmasq 都装了，提示 53 端口占用",
        "openclash": "OpenClash 的 Fake-IP 怎么选",
        "cross_dns": "AdGuard 和 OpenClash 一起用 DNS 怎么串",
        "topology": "我的光猫、路由、交换机、PVE 这么连对吗",
        "stability": "路由器老是断网",
    }

    @staticmethod
    def _old_baseline_chars() -> int:
        """The pre-split behaviour: full KB plus the old verbose base prompt."""
        full_kb = len(kb.load_core()) + sum(
            len(c) for c in kb.load_topics(kb.TOPIC_FILES).values()
        )
        return 3438 + full_kb

    @pytest.mark.parametrize("name,text", list(CASES.items()))
    def test_every_case_is_smaller_than_the_old_behaviour(self, name, text):
        prompt = build_system_prompt([_msg(text)])
        assert len(prompt) < self._old_baseline_chars(), (
            f"{name} regressed to {len(prompt)} chars"
        )

    def test_average_is_at_least_40_percent_smaller(self):
        sizes = [
            len(build_system_prompt([_msg(text)]))
            for text in self.CASES.values()
        ]
        average = sum(sizes) / len(sizes)
        baseline = self._old_baseline_chars()
        saving = 1 - average / baseline
        assert saving >= 0.40, f"average saving only {saving:.0%}"

    def test_a_dns_question_does_not_pull_the_openwrt_document(self):
        prompt = build_system_prompt(
            [_msg("我 AdGuard Home 和 dnsmasq 都装了，提示 53 端口占用")]
        )
        # A distinctive heading from 02_OpenWRT_Basic.md's firewall chapter.
        assert "防火墙与端口转发 (Firewall)" not in prompt
