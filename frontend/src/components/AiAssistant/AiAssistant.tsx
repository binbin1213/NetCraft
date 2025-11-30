import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Minus, X, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Input, Button, message, Tooltip, Modal, Form, Select } from 'antd';
import clsx from 'clsx';
import Draggable from 'react-draggable';

import { useShallow } from 'zustand/react/shallow';
import useStore from '../../store/useStore';
import { API_BASE_URL } from '../../config';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface LLMConfig {
    provider: string;
    model: string;
    api_key: string;
    base_url?: string;
}

const DEFAULT_CONFIG: LLMConfig = {
    provider: 'dashscope',
    model: 'qwen-turbo',
    api_key: '',
    base_url: ''
};

export default function AiAssistant() {
    const { nodes, edges } = useStore(useShallow((state: any) => ({ 
        nodes: state.nodes,
        edges: state.edges 
    })));
    const [isOpen, setIsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
    const [form] = Form.useForm();

    useEffect(() => {
        const savedConfig = localStorage.getItem('llm_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                setConfig({ ...DEFAULT_CONFIG, ...parsed });
                form.setFieldsValue({ ...DEFAULT_CONFIG, ...parsed });
            } catch (e) {
                console.error('Failed to parse saved config', e);
            }
        }
    }, []);

    const handleSaveSettings = (values: any) => {
        const newConfig = { ...config, ...values };
        setConfig(newConfig);
        localStorage.setItem('llm_config', JSON.stringify(newConfig));
        setIsSettingsOpen(false);
        message.success('设置已保存');
    };

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [messages, setMessages] = useState<Message[]>([
        { 
            role: 'assistant', 
            content: '你好！我是 NetCraft 网络架构专家。我可以帮你设计网络拓扑、配置 OpenWRT、优化 OpenClash 代理以及加强 DNS 安全。请告诉我你的需求。' 
        }
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<HTMLDivElement>(null);
    const buttonDragRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Toggle tooltip periodically
    useEffect(() => {
        // Initial show
        setShowTooltip(true);

        const cycle = () => {
            // Show for 3 seconds
            setShowTooltip(true);
            setTimeout(() => {
                setShowTooltip(false);
            }, 3000);
        };

        // Run the cycle immediately for the first time behavior (already true, but setting timer for hide)
        const initialHideTimer = setTimeout(() => {
            setShowTooltip(false);
        }, 3000);

        // Then repeat every 8 seconds (3s show + 5s hide)
        const intervalTimer = setInterval(cycle, 8000);

        return () => {
            clearTimeout(initialHideTimer);
            clearInterval(intervalTimer);
        };
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Prepare history for context (last 10 messages to save tokens)
            const history = messages.slice(-10).concat(userMsg).map(m => ({
                role: m.role,
                content: m.content
            }));

            // Inject current topology context systematically
            const topologyContext = `
Current Network Topology JSON:
${JSON.stringify({ nodes, edges }, null, 2)}
`;
            if (history.length > 0 && history[history.length - 1].role === 'user') {
                history[history.length - 1].content += `\n\n[Context Info]\n${topologyContext}`;
            }

            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: history,
                    config: {
                        provider: config.provider,
                        model: config.model,
                        api_key: config.api_key || undefined, // Don't send empty string
                        base_url: config.base_url || undefined
                    }
                })
            });

            if (!response.ok) throw new Error(response.statusText);
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMsg: Message = { role: 'assistant', content: '' };
            let fullResponse = '';
            
            setMessages(prev => [...prev, assistantMsg]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                fullResponse += chunk;
                assistantMsg.content += chunk;
                
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...assistantMsg };
                    return newMsgs;
                });
            }

            // Check for Action JSON at the end of the message
            const jsonMatch = fullResponse.match(/```json\s*(\{\s*"action":[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                try {
                    const actionData = JSON.parse(jsonMatch[1]);
                    if (actionData.action === 'update_topology') {
                        if (actionData.nodes) {
                            const currentNodes = useStore.getState().nodes;
                            const newNodesMap = new Map(actionData.nodes.map((n: any) => [n.id, n]));
                            
                            const updatedNodes = currentNodes.map(node => 
                                newNodesMap.has(node.id) ? { ...node, ...(newNodesMap.get(node.id) as object) } : node
                            );
                            
                            actionData.nodes.forEach((n: any) => {
                                if (!currentNodes.find(cn => cn.id === n.id)) {
                                    updatedNodes.push(n);
                                }
                            });
                            
                            useStore.getState().setNodes(updatedNodes);
                        }
                        if (actionData.edges) {
                            const currentEdges = useStore.getState().edges;
                            useStore.getState().setEdges([...currentEdges, ...actionData.edges]);
                        }
                        message.success('Topology updated by AI');
                    }
                } catch (e) {
                    console.error('Failed to parse AI action:', e);
                }
            }

        } catch (error) {
            console.error(error);
            message.error('AI 服务错误：请检查后端或 API Key');
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 错误：无法连接到 AI 服务。请确保后端正在运行且已配置 API Key。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const dragStartPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleButtonClick = (e: React.MouseEvent) => {
        const dist = Math.sqrt(
            Math.pow(e.clientX - dragStartPos.current.x, 2) + 
            Math.pow(e.clientY - dragStartPos.current.y, 2)
        );
        // Only treat as click if moved less than 5 pixels
        if (dist < 5) {
            setIsOpen(true);
        }
    };

    return (
        <>
            {/* Floating Trigger Button with Breathing & Tooltip */}
            {/* Always render Draggable to preserve position, hide via CSS when open */}
            <Draggable nodeRef={buttonDragRef} bounds="body">
                <div 
                    ref={buttonDragRef}
                    className={clsx(
                        "fixed bottom-10 right-10 z-50 flex flex-col items-center gap-3 cursor-move hover:z-[100]",
                        isOpen && "hidden"
                    )}
                >
                    {showTooltip && (
                        <div className="absolute -top-12 bg-white text-slate-900 px-4 py-2 rounded-xl shadow-2xl text-sm font-bold animate-bounce whitespace-nowrap select-none">
                            嗨，我在这！👋
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45"></div>
                        </div>
                    )}
                    <button
                        onMouseDown={handleMouseDown}
                        onClick={handleButtonClick}
                        className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)] transition-all duration-300 group"
                    >
                        {/* Strong Breathing Ring */}
                        <span className="absolute inset-0 rounded-full bg-cyan-400 opacity-20 animate-ping duration-[2000ms]" />
                        <span className="absolute -inset-1 rounded-full border-2 border-cyan-300/50 animate-pulse" />
                        
                        <Sparkles className="text-white w-8 h-8 relative z-10 drop-shadow-lg" />
                    </button>
                </div>
            </Draggable>

            {/* Draggable Chat Panel */}
            {isOpen && (
                <Draggable nodeRef={dragRef} handle=".drag-handle" bounds="body">
                    <div 
                        ref={dragRef}
                        className="fixed bottom-24 right-6 w-[500px] h-[600px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
                    >
                        {/* Header - Draggable Handle */}
                        <div className="drag-handle p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur cursor-move select-none">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                    <Bot className="text-white w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-100 text-sm">NetCraft AI Expert</h3>
                                    <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                                        Online
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Tooltip title="Settings">
                                    <button 
                                        onClick={() => {
                                            setIsSettingsOpen(true);
                                            form.setFieldsValue(config);
                                        }}
                                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                                    >
                                        <Settings size={18} />
                                    </button>
                                </Tooltip>
                                <Tooltip title="Minimize">
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                                    >
                                        <Minus size={18} />
                                    </button>
                                </Tooltip>
                                <Tooltip title="Close">
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-950/50">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                                        msg.role === 'user' ? "bg-slate-700" : "bg-cyan-900/30 border border-cyan-500/30"
                                    )}>
                                        {msg.role === 'user' ? <User size={16} className="text-slate-300"/> : <Bot size={16} className="text-cyan-400"/>}
                                    </div>
                                    
                                    <div className={clsx(
                                        "max-w-[calc(100%-3rem)] rounded-lg p-3 text-sm leading-relaxed shadow-sm break-words",
                                        msg.role === 'user' 
                                            ? "bg-slate-800 text-slate-200" 
                                            : "bg-[#1e293b] border border-slate-800 text-slate-300"
                                    )}>
                                        {msg.role === 'user' ? (
                                            msg.content
                                        ) : (
                                            <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-800 [&_code]:text-cyan-300 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3">
                                     <div className="w-8 h-8 rounded-full bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                                        <Bot size={16} className="text-cyan-400"/>
                                    </div>
                                    <div className="bg-[#1e293b] border border-slate-800 rounded-lg p-3 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                                        <span className="text-xs text-slate-500">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-5 border-t border-slate-800 bg-slate-900 flex flex-col justify-center">
                            <div className="flex gap-3 items-center h-12">
                                <Input.TextArea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="询问关于 OpenWRT、OpenClash 或网络设计的问题..."
                                    autoSize={false}
                                    className="!h-full !bg-slate-800 !border-slate-700 !text-slate-200 placeholder:!text-slate-500 placeholder:!text-sm focus:!border-cyan-500 hover:!border-slate-600 custom-scrollbar !rounded-xl !text-base !py-2.5 !px-4 !resize-none"
                                />
                                <Button 
                                    type="primary"
                                    icon={isLoading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20} />}
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim()}
                                    className={clsx(
                                        "h-12 w-12 !min-w-[48px] !p-0 flex items-center justify-center border-none rounded-xl shadow-lg transition-all flex-shrink-0",
                                        isLoading || !input.trim() 
                                            ? "!bg-slate-700 !text-slate-500 cursor-not-allowed shadow-none" 
                                            : "bg-cyan-600 hover:!bg-cyan-500 hover:scale-105 text-white"
                                    )}
                                />
                            </div>
                            <div className="mt-3 text-center">
                                <span className="text-[10px] text-slate-600">由 Qwen Turbo 驱动 • AI 回复可能存在误差</span>
                            </div>
                        </div>
                    </div>
                </Draggable>
            )}
            {/* Settings Modal */}
            <Modal
                title="AI 配置"
                open={isSettingsOpen}
                onOk={form.submit}
                onCancel={() => setIsSettingsOpen(false)}
                okText="保存"
                cancelText="取消"
                width={500}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveSettings}
                    initialValues={config}
                >
                    <Form.Item
                        name="provider"
                        label="服务提供商"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="dashscope">DashScope (通义千问)</Select.Option>
                            <Select.Option value="openai">OpenAI</Select.Option>
                            <Select.Option value="deepseek">DeepSeek (深度求索)</Select.Option>
                            <Select.Option value="moonshot">Moonshot (Kimi)</Select.Option>
                            <Select.Option value="claude">Anthropic (Claude)</Select.Option>
                            <Select.Option value="gemini">Google (Gemini)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="model"
                        label="模型名称"
                        rules={[{ required: true }]}
                        help="例如：qwen-turbo, gpt-4o, deepseek-chat"
                    >
                        <Input placeholder="qwen-turbo" />
                    </Form.Item>

                    <Form.Item
                        name="api_key"
                        label="API 密钥"
                        rules={[{ required: false }]}
                        help="留空则使用后端环境变量 (如果可用)"
                    >
                        <Input.Password placeholder="sk-..." />
                    </Form.Item>

                    <Form.Item
                        name="base_url"
                        label="代理地址 (Base URL - 可选)"
                        help="DeepSeek/Moonshot 等兼容接口必填 (例如 https://api.deepseek.com)"
                    >
                        <Input placeholder="https://api.openai.com/v1" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
