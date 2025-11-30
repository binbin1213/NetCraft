import { ConfigProvider, theme, App as AntdApp } from 'antd';
import { useState } from 'react';
import { Form, Input, Button, Card, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { api } from '../../api/client';
import useStore from '../../store/useStore';

export default function Login({ isModal = false, onSuccess }: { isModal?: boolean; onSuccess?: () => void }) {
    const [loading, setLoading] = useState(false);
    const { setToken, setUser } = useStore();
    const [activeTab, setActiveTab] = useState('login');
    const { message } = AntdApp.useApp();

    const onFinishLogin = async (values: any) => {
        setLoading(true);
        try {
            const { access_token } = await api.login(values.username, values.password);
            setToken(access_token);
            message.success('登录成功');
            
            // Fetch user info
            const user = await api.getCurrentUser();
            setUser(user);
            onSuccess?.();
        } catch (error: any) {
            message.error(error.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

    const onFinishRegister = async (values: any) => {
        setLoading(true);
        try {
            await api.register(values.username, values.password, values.email);
            message.success('注册成功，请登录');
            setActiveTab('login');
            // onSuccess is not called here because user needs to login after register
        } catch (error: any) {
            message.error(error.message || '注册失败');
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <Card className={`w-full ${isModal ? 'border-0 shadow-none bg-transparent' : 'w-96 bg-slate-900 border-slate-800 shadow-2xl'}`}>
            {!isModal && (
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-100">NetCraft</h1>
                    <p className="text-slate-400">网络架构设计平台</p>
                </div>
            )}
            
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                centered
                items={[
                    {
                        key: 'login',
                        label: '登录',
                        children: (
                            <Form
                                name="login"
                                onFinish={onFinishLogin}
                                layout="vertical"
                                size="large"
                            >
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: '请输入用户名' }]}
                                >
                                    <Input 
                                        prefix={<UserOutlined className="text-slate-400" />} 
                                        placeholder="用户名" 
                                        className="!bg-slate-800 !border-slate-700 !text-slate-100 placeholder:!text-slate-500 hover:!border-cyan-500 focus:!border-cyan-500"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: '请输入密码' }]}
                                >
                                    <Input.Password 
                                        prefix={<LockOutlined className="text-slate-400" />} 
                                        placeholder="密码"
                                        className="!bg-slate-800 !border-slate-700 !text-slate-100 placeholder:!text-slate-500 hover:!border-cyan-500 focus:!border-cyan-500"
                                    />
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" block loading={loading} className="bg-cyan-600 hover:bg-cyan-500 border-none h-10">
                                        登录
                                    </Button>
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: 'register',
                        label: '注册',
                        children: (
                            <Form
                                name="register"
                                onFinish={onFinishRegister}
                                layout="vertical"
                                size="large"
                            >
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: '请输入用户名' }]}
                                >
                                    <Input 
                                        prefix={<UserOutlined className="text-slate-400" />} 
                                        placeholder="用户名"
                                        className="!bg-slate-800 !border-slate-700 !text-slate-100 placeholder:!text-slate-500 hover:!border-cyan-500 focus:!border-cyan-500"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="email"
                                    rules={[{ type: 'email', message: '请输入有效的邮箱' }]}
                                >
                                    <Input 
                                        prefix={<MailOutlined className="text-slate-400" />} 
                                        placeholder="邮箱 (可选)"
                                        className="!bg-slate-800 !border-slate-700 !text-slate-100 placeholder:!text-slate-500 hover:!border-cyan-500 focus:!border-cyan-500"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: '请输入密码' }]}
                                >
                                    <Input.Password 
                                        prefix={<LockOutlined className="text-slate-400" />} 
                                        placeholder="密码"
                                        className="!bg-slate-800 !border-slate-700 !text-slate-100 placeholder:!text-slate-500 hover:!border-cyan-500 focus:!border-cyan-500"
                                    />
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" block loading={loading} className="bg-cyan-600 hover:bg-cyan-500 border-none h-10">
                                        注册
                                    </Button>
                                </Form.Item>
                            </Form>
                        ),
                    },
                ]}
            />
        </Card>
    );

    if (isModal) {
        return content;
    }

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#0891b2', // cyan-600
                    colorBgContainer: '#0f172a', // slate-900
                }
            }}
        >
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                {content}
            </div>
        </ConfigProvider>
    );
}