import dagre from 'dagre';
import { type Node, type Edge, Position } from 'reactflow';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220; // w-52 = 13rem = 208px + padding
const nodeHeight = 100;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  
  // Set more compact layout settings
  dagreGraph.setGraph({ 
      rankdir: direction,
      ranksep: 80, // Vertical spacing between layers
      nodesep: 30  // Horizontal spacing between nodes (more compact)
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  // Intelligent Handle Assignment (Optimization for TB layout)
  // Sort edges by target X position to minimize crossings and use closest handles
  if (!isHorizontal) {
      const edgesBySource: Record<string, Edge[]> = {};
      
      // Group edges by source
      edges.forEach(edge => {
          if (!edgesBySource[edge.source]) {
              edgesBySource[edge.source] = [];
          }
          edgesBySource[edge.source].push(edge);
      });

      // Assign handles based on geometric order
      Object.keys(edgesBySource).forEach(sourceId => {
          const sourceEdges = edgesBySource[sourceId];
          const sourceNode = layoutedNodes.find(n => n.id === sourceId);
          const availablePorts = sourceNode?.data?.interfaceCount ?? 3;
          
          // Sort edges based on Target Node's X position
          sourceEdges.sort((a, b) => {
              const nodeA = layoutedNodes.find(n => n.id === a.target);
              const nodeB = layoutedNodes.find(n => n.id === b.target);
              return (nodeA?.position.x || 0) - (nodeB?.position.x || 0);
          });

          // Calculate offset to center the connections
          // e.g. 3 ports, 1 edge -> offset = floor((3-1)/2) = 1. Index 0 becomes port 1+1=2 (lan2)
          const connectionCount = sourceEdges.length;
          let startOffset = 0;
          
          if (connectionCount <= availablePorts) {
              startOffset = Math.floor((availablePorts - connectionCount) / 2);
          }

          // Distribute edges across available ports
          sourceEdges.forEach((edge, index) => {
              // If we have more edges than ports, we fallback to modulo (cycle)
              // Otherwise we use the centered offset
              let portIndex;
              
              if (connectionCount <= availablePorts) {
                  portIndex = startOffset + index + 1;
              } else {
                  portIndex = (index % availablePorts) + 1; 
              }
              
              edge.sourceHandle = `lan${portIndex}`;
              edge.targetHandle = 'wan'; // Always connect to WAN (Top) on target
          });
      });
  }

  // Return a new array for edges to trigger React Flow update
  return { nodes: layoutedNodes, edges: [...edges] };
};
