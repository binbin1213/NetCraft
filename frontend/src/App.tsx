import Sidebar from './components/Sidebar/Sidebar';
import Canvas from './components/Canvas/Canvas';
import PropertiesPanel from './components/Properties/PropertiesPanel';
import GuideSystem from './components/Guide/GuideSystem';
import Login from './components/Auth/Login';
import useStore from './store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Button, App as AntdApp, Modal, ConfigProvider, theme } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';

function App() {
  const { token, user, logout, loginModalOpen, setLoginModalOpen } = useStore(
    useShallow((state) => ({
      token: state.token,
      user: state.user,
      logout: state.logout,
      loginModalOpen: state.loginModalOpen,
      setLoginModalOpen: state.setLoginModalOpen,
    }))
  );

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
        <AntdApp>
            <div className="flex w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 relative">
                {/* Intelligent Guide System (Invisible, just logic & notifications) */}
                <GuideSystem />

                {/* Left Sidebar - Component Library */}
                <Sidebar />
                
                {/* Middle - Main Canvas */}
                <Canvas />
                
                {/* Right Sidebar - Properties */}
                <PropertiesPanel />

                {/* User Info / Logout (Absolute positioning top-right) */}
                {token && user && (
                    <div className="absolute top-4 right-4 z-50 flex items-center gap-4 bg-slate-900/80 p-2 rounded-lg backdrop-blur border border-slate-800">
                        <div className="text-sm">
                            <span className="text-slate-400">User: </span>
                            <span className="text-cyan-400 font-medium">{user?.username}</span>
                        </div>
                        <Button 
                            type="text" 
                            icon={<LogoutOutlined />} 
                            onClick={logout}
                            className="text-slate-400 hover:text-red-400"
                        />
                    </div>
                )}
            </div>

            <Modal
                open={loginModalOpen}
                onCancel={() => setLoginModalOpen(false)}
                footer={null}
                width={400}
                centered
                destroyOnClose
                styles={{ mask: { backdropFilter: 'blur(4px)' } }}
            >
                <Login isModal onSuccess={() => setLoginModalOpen(false)} />
            </Modal>
        </AntdApp>
    </ConfigProvider>
  );
}

export default App;
