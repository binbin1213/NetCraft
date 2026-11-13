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
import { edgeExists } from '../utils/graph';

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

  // The cloud project currently open on the canvas.
  // Server is the single source of truth; there is no local project list.
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;
  // True once the canvas differs from the last saved snapshot.
  isDirty: boolean;
  markClean: () => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node<DeviceData>) => void;
  addEdge: (edge: Edge<EdgeData>) => void;
  updateNodeData: (id: string, data: Partial<DeviceData>) => void;
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void;
  setNodes: (nodes: Node<DeviceData>[]) => void;
  setEdges: (edges: Edge<EdgeData>[]) => void;
  resetCanvas: () => void;
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
        logout: () => set({
            token: null,
            user: null,
            currentProjectId: null,
            nodes: [],
            edges: [],
        }),

        // Cloud project state
        currentProjectId: null,
        setCurrentProjectId: (id) => set({ currentProjectId: id }),
        isDirty: false,
        markClean: () => set({ isDirty: false }),

        // Graph State
        nodes: [],
        edges: [],
        onNodesChange: (changes: NodeChange[]) => {
          set({
            nodes: applyNodeChanges(changes, get().nodes),
            isDirty: true,
          });
        },
        onEdgesChange: (changes: EdgeChange[]) => {
          set({
            edges: applyEdgeChanges(changes, get().edges),
            isDirty: true,
          });
        },
        onConnect: (connection: Connection) => {
          const edges = get().edges;
          // Prevent duplicate connections between same nodes (bidirectional check)
          // A->B is same as B->A for physical cables
          if (edgeExists(edges, connection.source, connection.target)) {
              return; // Do nothing if connection already exists
          }

          // Add new edge
          const newEdge = { ...connection, type: 'smartEdge', data: { type: 'eth_1g' } };
          set({
            edges: addEdge(newEdge, edges),
            isDirty: true,
          });
        },
        addNode: (node: Node<DeviceData>) => {
          set({
            nodes: [...get().nodes, node],
            isDirty: true,
          });
        },
        addEdge: (edge: Edge<EdgeData>) => {
          const edges = get().edges;
          if (edgeExists(edges, edge.source, edge.target)) {
            return;
          }
          set({
            edges: addEdge(edge, edges),
            isDirty: true,
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
            isDirty: true,
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
            }),
            isDirty: true,
          })
        },
        setNodes: (nodes) => set({ nodes, isDirty: true }),
        setEdges: (edges) => set({ edges, isDirty: true }),
        resetCanvas: () => set({ nodes: [], edges: [], currentProjectId: null, isDirty: false }),
      }),
      {
        name: 'netcraft-storage',
        storage: createJSONStorage(() => localStorage),
        // Persist auth session and the live canvas (unsaved work survives reload),
        // but never the project list: that lives on the server.
        partialize: (state) => ({
            nodes: state.nodes,
            edges: state.edges,
            token: state.token,
            user: state.user,
            currentProjectId: state.currentProjectId,
            isDirty: state.isDirty,
        }),
        version: 2,
        migrate: (persistedState: unknown) => {
            // Always sanitize state to prevent crashes and duplicates
            const state = (persistedState ?? {}) as Partial<RFStateShape>;
            const validNodes = Array.isArray(state.nodes) ? state.nodes : [];
            const validEdges = Array.isArray(state.edges) ? state.edges : [];

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

            // v1 kept a local uuid-keyed project list here. It had no link to the
            // cloud API, so it is dropped on migration.
            return {
                ...state,
                nodes: validNodes,
                edges: uniqueEdges,
                currentProjectId:
                    typeof state.currentProjectId === 'number'
                        ? state.currentProjectId
                        : null,
                isDirty: Boolean(state.isDirty),
            };
        },
      }
    ),
    {
      // Cap the undo history so long editing sessions do not grow without bound.
      limit: 50,
    }
  )
);

/** Read-only shape of the store, handy for typing selectors. */
export type RFStateShape = RFState;

export default useStore;
