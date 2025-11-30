import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import {
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import { type DeviceData, type EdgeData } from '../types/nodes';

export interface User {
    id: number;
    username: string;
    email?: string;
    created_at: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    loginModalOpen: boolean;
    setToken: (token: string | null) => void;
    setUser: (user: User | null) => void;
    setLoginModalOpen: (open: boolean) => void;
    logout: () => void;
}

interface RFState extends AuthState {
  nodes: Node<DeviceData>[];
  edges: Edge<EdgeData>[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node<DeviceData>) => void;
  addEdge: (edge: Edge<EdgeData>) => void; // Added manual addEdge action
  updateNodeData: (id: string, data: Partial<DeviceData>) => void;
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void;
  setNodes: (nodes: Node<DeviceData>[]) => void; // Added for templates/layout
  setEdges: (edges: Edge<EdgeData>[]) => void;   // Added for templates/layout
}

const useStore = create<RFState>()(
  temporal(
    persist(
      (set, get) => ({
        // Auth State
        token: null,
        user: null,
        loginModalOpen: false,
        setToken: (token) => set({ token }),
        setUser: (user) => set({ user }),
        setLoginModalOpen: (open) => set({ loginModalOpen: open }),
        logout: () => set({ token: null, user: null }),

        // Graph State
        nodes: [],
        edges: [],
        onNodesChange: (changes: NodeChange[]) => {
          set({
            nodes: applyNodeChanges(changes, get().nodes),
          });
        },
        onEdgesChange: (changes: EdgeChange[]) => {
          set({
            edges: applyEdgeChanges(changes, get().edges),
          });
        },
        onConnect: (connection: Connection) => {
          const edges = get().edges;
          // Prevent duplicate connections between same nodes
          const exists = edges.some(
            (e) => 
              (e.source === connection.source && e.target === connection.target) ||
              (e.source === connection.target && e.target === connection.source)
          );

          if (exists) {
              return; // Do nothing if connection already exists
          }

          set({
            edges: addEdge({ ...connection, type: 'smartEdge', data: { type: 'eth_1g' } }, edges),
          });
        },
        addNode: (node: Node<DeviceData>) => {
          set({
            nodes: [...get().nodes, node],
          });
        },
        addEdge: (edge: Edge<EdgeData>) => {
          set({
            edges: addEdge(edge, get().edges),
          });
        },
        updateNodeData: (id: string, data: Partial<DeviceData>) => {
          set({
            nodes: get().nodes.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  data: { ...node.data, ...data },
                };
              }
              return node;
            }),
          });
        },
        updateEdgeData: (id: string, data: Partial<EdgeData>) => {
          set({
            edges: get().edges.map((edge) => {
              if (edge.id === id) {
                return {
                  ...edge,
                  data: { ...edge.data, ...data } as EdgeData
                }
              }
              return edge;
            })
          })
        },
        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),
      }),
      {
        name: 'netcraft-storage',
        storage: createJSONStorage(() => localStorage),
        // We persist auth state too
        partialize: (state) => ({ 
            nodes: state.nodes, 
            edges: state.edges,
            token: state.token,
            user: state.user
        }),
      }
    )
  )
);

export default useStore;
