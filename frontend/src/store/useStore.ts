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

// Simple UUID generator
const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};


export interface User {
    id: number;
    username: string;
    email?: string;
    created_at: string;
}

export interface Project {
    id: string;
    name: string;
    nodes: Node<DeviceData>[];
    edges: Edge<EdgeData>[];
    updatedAt: number;
    thumbnail?: string; // Optional for future
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
  
  // Project Management
  projects: Project[];
  currentProjectId: string | null;
  createProject: (name: string) => void;
  loadProject: (id: string) => void;
  saveProject: () => void; // Sync current state to project list
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

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

        // Project Management
        projects: [],
        currentProjectId: null,
        createProject: (name: string) => {
            const newProject: Project = {
                id: uuidv4(),
                name,
                nodes: [],
                edges: [],
                updatedAt: Date.now()
            };
            // If we have current nodes/edges and no project is loaded, maybe we should prompt?
            // For now, create new empty project and switch to it
            set((state) => ({
                projects: [...state.projects, newProject],
                currentProjectId: newProject.id,
                nodes: [],
                edges: []
            }));
        },
        loadProject: (id: string) => {
            const state = get();
            // Auto-save current if in a project
            if (state.currentProjectId) {
                state.saveProject();
            }

            const project = state.projects.find(p => p.id === id);
            if (project) {
                set({
                    currentProjectId: id,
                    nodes: project.nodes,
                    edges: project.edges
                });
            }
        },
        saveProject: () => {
            const state = get();
            if (state.currentProjectId) {
                set({
                    projects: state.projects.map(p => 
                        p.id === state.currentProjectId 
                        ? { ...p, nodes: state.nodes, edges: state.edges, updatedAt: Date.now() }
                        : p
                    )
                });
            }
        },
        deleteProject: (id: string) => {
            set((state) => {
                const newProjects = state.projects.filter(p => p.id !== id);
                // If deleting current project, clear canvas or switch to another?
                if (state.currentProjectId === id) {
                    return {
                        projects: newProjects,
                        currentProjectId: null,
                        nodes: [],
                        edges: []
                    };
                }
                return { projects: newProjects };
            });
        },
        renameProject: (id: string, name: string) => {
            set((state) => ({
                projects: state.projects.map(p => 
                    p.id === id ? { ...p, name } : p
                )
            }));
        },

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
          // Prevent duplicate connections between same nodes (bidirectional check)
          // A->B is same as B->A for physical cables
          const exists = edges.some(
            (e) => 
              (e.source === connection.source && e.target === connection.target) ||
              (e.source === connection.target && e.target === connection.source)
          );

          if (exists) {
              return; // Do nothing if connection already exists
          }

          // Add new edge
          const newEdge = { ...connection, type: 'smartEdge', data: { type: 'eth_1g' } };
          set({
            edges: addEdge(newEdge, edges),
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
            user: state.user,
            projects: state.projects,
            currentProjectId: state.currentProjectId
        }),
        version: 1,
        migrate: (persistedState: any, _version) => {
            // Always sanitize state to prevent crashes and duplicates
            const validNodes = Array.isArray(persistedState.nodes) ? persistedState.nodes : [];
            const validEdges = Array.isArray(persistedState.edges) ? persistedState.edges : [];
            const validProjects = Array.isArray(persistedState.projects) ? persistedState.projects : [];

            // Deduplicate edges based on source-target (bidirectional)
            const uniqueEdges = [];
            const edgeSignatures = new Set();
            
            for (const edge of validEdges) {
                // Create a sorted signature so A->B and B->A are treated as the same connection
                const signature = [edge.source, edge.target].sort().join('-');
                if (!edgeSignatures.has(signature)) {
                    edgeSignatures.add(signature);
                    uniqueEdges.push(edge);
                }
            }

            return {
                ...persistedState,
                nodes: validNodes,
                edges: uniqueEdges,
                projects: validProjects,
                currentProjectId: persistedState.currentProjectId || null,
            };
        },
      }
    )
  )
);

export default useStore;
