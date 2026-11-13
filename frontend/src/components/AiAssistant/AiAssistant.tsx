import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Minus, X, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Input, Button, Tooltip, Modal, Form, Select, App as AntdApp } from 'antd';
import { type DeviceData, type EdgeData } from '../../types/nodes';
import clsx from 'clsx';
import Draggable from 'react-draggable';

import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../../store/useStore';
import { API_BASE_URL } from '../../config';
import { getLayoutedElements } from '../../utils/autoLayout';
import { edgeExists } from '../../utils/graph';

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

/**
 * Shape of the JSON action block the model is instructed to emit.
 * Fields are optional because the payload comes from an LLM, not from us;
 * everything is normalised before it reaches the store.
 */
interface TopologyAction {
    action: 'update_topology' | 'auto_layout';
    nodes?: Array<{
        id: string;
        position?: { x?: number; y?: number };
        data?: Partial<DeviceData>;
        [key: string]: unknown;
    }>;
    edges?: Array<{
        id?: string;
        source: string;
        target: string;
        data?: Partial<EdgeData>;
        [key: string]: unknown;
    }>;
    direction?: string;
}

const DEFAULT_CONFIG: LLMConfig = {
    provider: 'dashscope',
    model: 'qwen-turbo',
    api_key: '',
    base_url: ''
};

export default function AiAssistant() {
    const { message } = AntdApp.useApp();
    const { t } = useTranslation();
    const { nodes, edges } = useStore(useShallow((state) => ({ 
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
        // form is a stable Ant Design instance; including it avoids a stale
        // closure if that ever changes.
    }, [form]);

    const handleSaveSettings = (values: Partial<LLMConfig>) => {
        const newConfig = { ...config, ...values };
        setConfig(newConfig);
        localStorage.setItem('llm_config', JSON.stringify(newConfig));
        setIsSettingsOpen(false);
        message.success(t('ai.settingsSaved'));
    };

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: t('ai.greeting') }
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

        const token = useStore.getState().token;
        if (!token) {
            message.warning(t('ai.loginRequired'));
            return;
        }

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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
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
            const assistantMsg: Message = { role: 'assistant', content: '' };
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
                    const actionData = JSON.parse(jsonMatch[1]) as TopologyAction;
                    if (actionData.action === 'update_topology') {
                        if (actionData.nodes) {
                            const currentNodes = useStore.getState().nodes;
                            const newNodesMap = new Map(actionData.nodes.map((n) => [n.id, n]));
                            
                            const updatedNodes = currentNodes.map(node => 
                                newNodesMap.has(node.id) ? { ...node, ...(newNodesMap.get(node.id) as object) } : node
                            );
                            
                            actionData.nodes.forEach((n) => {
                                if (!currentNodes.find(cn => cn.id === n.id)) {
                                    // Model-supplied nodes may omit position or
                                    // data; fill in safe defaults so React Flow
                                    // can render them.
                                    updatedNodes.push({
                                        id: n.id,
                                        type: 'deviceNode',
                                        position: {
                                            x: n.position?.x ?? 0,
                                            y: n.position?.y ?? 0,
                                        },
                                        data: {
                                            name: n.data?.name ?? n.id,
                                            type: n.data?.type ?? 'pc',
                                            ip: n.data?.ip ?? '',
                                            services: n.data?.services ?? [],
                                        },
                                    });
                                }
                            });
                            
                            useStore.getState().setNodes(updatedNodes);
                        }
                        if (actionData.edges) {
                            const currentEdges = useStore.getState().edges;
                            // Skip edges that already exist (manual connect uses the
                            // same bidirectional rule), otherwise the canvas would
                            // end up with visually overlapping duplicate links.
                            const newEdges = actionData.edges
                                .filter((e) => !edgeExists(currentEdges, e.source, e.target))
                                .map((e) => ({
                                    id: e.id ?? `ai_edge_${e.source}_${e.target}`,
                                    source: e.source,
                                    target: e.target,
                                    type: 'smartEdge',
                                    data: { type: e.data?.type ?? 'eth_1g', animated: true },
                                }));
                            useStore.getState().setEdges([...currentEdges, ...newEdges]);
                        }
                        message.success(t('ai.topologyUpdated'));
                    } else if (actionData.action === 'auto_layout') {
                        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                            useStore.getState().nodes,
                            useStore.getState().edges,
                            actionData.direction || 'TB'
                        );
                        useStore.getState().setNodes(layoutedNodes);
                        useStore.getState().setEdges(layoutedEdges);
                        message.success(t('ai.layoutApplied'));
                    }
                } catch (e) {
                    console.error('Failed to parse AI action:', e);
                }
            }

        } catch (error) {
            console.error(error);
            message.error(t('ai.serviceError'));
            setMessages(prev => [...prev, { role: 'assistant', content: t('ai.connectFailed') }]);
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
                            {t('ai.hint')}
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
                                    <h3 className="font-bold text-slate-100 text-sm">{t('ai.title')}</h3>
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
                                        <span className="text-xs text-slate-500">{t('ai.thinking')}</span>
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
                                    placeholder={t('ai.placeholder')}
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
                                <span className="text-[10px] text-slate-600">{t('ai.footer')}</span>
                            </div>
                        </div>
                    </div>
                </Draggable>
            )}
            {/* Settings Modal */}
            <Modal
                title={t('ai.settingsTitle')}
                open={isSettingsOpen}
                onOk={form.submit}
                onCancel={() => setIsSettingsOpen(false)}
                okText={t('common.save')}
                cancelText={t('common.cancel')}
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
                        label={t('ai.provider')}
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
                        label={t('ai.model')}
                        rules={[{ required: true }]}
                        help={t('ai.modelHelp')}
                    >
                        <Input placeholder="qwen-turbo" />
                    </Form.Item>

                    <Form.Item
                        name="api_key"
                        label={t('ai.apiKey')}
                        rules={[{ required: false }]}
                        help={t('ai.apiKeyHelp')}
                    >
                        <Input.Password placeholder="sk-..." />
                    </Form.Item>

                    <Form.Item
                        name="base_url"
                        label={t('ai.baseUrl')}
                        help={t('ai.baseUrlHelp')}
                    >
                        <Input placeholder="https://api.openai.com/v1" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
