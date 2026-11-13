"""Knowledge base loading and per-request topic selection.

The knowledge base used to be concatenated in full into every system prompt,
which made it ~79% of the prompt (~5.4k tokens) on every message. It now has a
small always-on core plus per-topic documents that are included only when the
conversation actually touches that topic.
"""

import glob
import os
from typing import Dict, Iterable, List, Sequence

CORE_FILE = "00_Core_Constraints.md"

# Topic id -> document file name. Order matters only for prompt assembly.
TOPIC_FILES: Dict[str, str] = {
    "openwrt": "02_OpenWRT_Basic.md",
    "openclash": "03_OpenClash_Config.md",
    "adguard": "04_AdGuardHome.md",
    "stability": "05_Stability_Optimization.md",
    "architecture": "01_Network_Architecture.md",
}

# Small extract used when several DNS components are combined. Pulling the full
# OpenWRT document in that case costs ~3k chars for a few lines of DNS setup.
DNS_INTEROP_FILE = "06_DNS_Interop.md"

# Keywords that indicate a conversation needs a topic document.
# Matching is case-insensitive substring matching; Chinese has no word
# boundaries, so substring is the practical choice.
TOPIC_KEYWORDS: Dict[str, Sequence[str]] = {
    # Deliberately excludes dnsmasq/53: those are DNS-stack questions handled
    # by the adguard/openclash topics plus the interop extract, and matching
    # them here would pull in ~3k chars of interface and firewall material.
    "openwrt": [
        "openwrt", "open wrt", "/etc/config", "防火墙", "端口转发",
        "wan口", "lan口", "opkg", "软路由", "接口配置",
    ],
    "openclash": [
        "openclash", "clash", "代理", "翻墙", "分流", "fake-ip", "fakeip",
        "redir-host", "策略组", "订阅", "节点", "tun模式", "dns泄露", "dns 泄露",
    ],
    "adguard": [
        "adguard", "ad guard", "去广告", "广告拦截", "拦截列表", "黑名单",
        "doh", "dot", "上游dns", "上游 dns", "dnsmasq", "53 端口", "53端口",
    ],
    "stability": [
        "稳定", "优化", "卡顿", "断网", "重启", "watchcat", "看门狗",
        "信道", "漫游", "bbr", "offload", "卸载", "性能调优", "wifi", "wi-fi", "无线",
    ],
    "architecture": [
        "拓扑", "架构", "旁路由", "桥接", "nat", "vlan", "子网", "网段",
        "mesh", "回程", "组网", "规划",
    ],
}


def _kb_search_paths() -> List[str]:
    """Return the KnowledgeBase directory in dev and in the container."""
    here = os.path.dirname(os.path.abspath(__file__))
    # backend/app/services -> repository root
    local = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(here))),
        "RAG",
        "KnowledgeBase",
    )
    container = "/code/RAG/KnowledgeBase"
    for candidate in (local, container):
        if os.path.isdir(candidate):
            return [candidate]
    return [local]


def _read(filename: str) -> str:
    for base in _kb_search_paths():
        path = os.path.join(base, filename)
        if os.path.isfile(path):
            try:
                with open(path, encoding="utf-8") as handle:
                    return handle.read()
            except OSError as exc:  # pragma: no cover - filesystem guard
                print(f"Error loading knowledge file {path}: {exc}")
    return ""


def load_core() -> str:
    """Always-on constraints: design principles, port map, IP plan, Wi-Fi."""
    return _read(CORE_FILE)


def load_topics(topics: Iterable[str]) -> Dict[str, str]:
    """Load the requested topic documents, skipping unknown ids."""
    return {t: _read(TOPIC_FILES[t]) for t in topics if t in TOPIC_FILES}


def detect_topics(messages: Sequence[dict]) -> List[str]:
    """Pick topics mentioned in the recent conversation.

    Only the last few user turns are scanned: earlier context is already
    summarised by the model, and scanning everything makes the selection
    drift towards "all topics" on long conversations.
    """
    recent = " ".join(
        str(m.get("content", "")) for m in messages[-6:] if m.get("role") == "user"
    ).lower()
    if not recent:
        return []

    matched = [
        topic
        for topic, keywords in TOPIC_KEYWORDS.items()
        if any(keyword in recent for keyword in keywords)
    ]

    return matched


def is_dns_cross_topic(topics: Sequence[str]) -> bool:
    """True when the user is combining DNS components.

    Such questions need each component's DNS section plus the interop notes,
    but not the full OpenWRT document (~3k chars) just for its DHCP chapter.
    """
    return len({"openclash", "adguard"} & set(topics)) == 2


def build_knowledge_section(topics: Iterable[str]) -> str:
    """Assemble the knowledge block injected into the system prompt."""
    topics = list(topics)
    parts: List[str] = []
    core = load_core()
    if core:
        parts.append(core)

    for topic, content in load_topics(topics).items():
        if content:
            parts.append(
                f"--- BEGIN TOPIC: {TOPIC_FILES[topic]} ---\n{content}\n"
                f"--- END TOPIC: {TOPIC_FILES[topic]} ---"
            )

    # When two DNS components are combined, the DHCP interop notes are what
    # actually answer the question; the rest of the OpenWRT doc is noise.
    if is_dns_cross_topic(topics):
        interop = _read(DNS_INTEROP_FILE)
        if interop:
            parts.append(
                f"--- BEGIN TOPIC: {DNS_INTEROP_FILE} ---\n{interop}\n"
                f"--- END TOPIC: {DNS_INTEROP_FILE} ---"
            )
    return "\n\n".join(parts)


def all_files_present() -> bool:
    """Sanity check used at startup to warn about a missing/empty KB."""
    pattern = os.path.join(_kb_search_paths()[0], "*.md")
    return len(glob.glob(pattern)) >= 2
