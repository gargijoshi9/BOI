import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { NetworkConnections, NodeType } from '../api/client'

// Visual type can be richer than the API's three values
// API type: 'normal' | 'mule' | 'cash_out'
// Internal visual: 'victim' | 'mule' | 'relay' | 'cash_out' (relay used by mock data)
type VisualType = 'victim' | 'mule' | 'relay' | 'cash_out'

type GraphNode = d3.SimulationNodeDatum & {
  id: string
  label: string
  type: VisualType
  layer: number
}

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode
  target: string | GraphNode
  amount: number
}

interface NetworkGraphProps {
  networkConnections?: NetworkConnections
  height?: number
}

const NODE_FILL: Record<VisualType, string> = {
  victim: '#3b82f6',
  mule: '#ef4444',
  relay: '#f97316',
  cash_out: '#8b5cf6',
}

const MOCK_NODES: GraphNode[] = [
  { id: 'V1', label: 'V1', type: 'victim', layer: 0 },
  { id: 'M1', label: 'M1', type: 'mule', layer: 1 },
  { id: 'M2', label: 'M2', type: 'mule', layer: 1 },
  { id: 'M3', label: 'M3', type: 'mule', layer: 2 },
  { id: 'R1', label: 'R1', type: 'relay', layer: 2 },
  { id: 'C1', label: 'C1', type: 'cash_out', layer: 3 },
]

const MOCK_LINKS: GraphLink[] = [
  { source: 'V1', target: 'M1', amount: 120000 },
  { source: 'V1', target: 'M2', amount: 80000 },
  { source: 'M1', target: 'R1', amount: 110000 },
  { source: 'M2', target: 'R1', amount: 75000 },
  { source: 'R1', target: 'M3', amount: 60000 },
  { source: 'M3', target: 'C1', amount: 180000 },
]

const NODE_RADIUS = 18
const EDGE_COLOR = '#94a3b8'
const STROKE_COLOR = '#FFFFFF'

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const formatRupee = (n: number) => '₹' + inr.format(n)

// Map API node type → visual node type
function apiToVisual(t: NodeType): VisualType {
  if (t === 'cash_out') return 'cash_out'
  if (t === 'mule') return 'mule'
  return 'victim' // 'normal' → 'victim'
}

// Choose a column index by visual type so real API data has a sensible layout
function layerFor(t: VisualType): number {
  if (t === 'victim') return 0
  if (t === 'mule') return 1
  if (t === 'relay') return 2
  return 3
}

function NetworkGraph({ networkConnections, height = 320 }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    let nodes: GraphNode[]
    let links: GraphLink[]

    if (networkConnections && networkConnections.nodes.length > 0) {
      nodes = networkConnections.nodes.map((n) => {
        const v = apiToVisual(n.type)
        return {
          id: n.id,
          label: n.id,
          type: v,
          layer: layerFor(v),
        }
      })
      links = networkConnections.edges.map((e) => ({
        source: e.source,
        target: e.target,
        amount: e.amount,
      }))
    } else {
      nodes = MOCK_NODES.map((n) => ({ ...n }))
      links = MOCK_LINKS.map((l) => ({ ...l }))
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const draw = (width: number) => {
      svg.selectAll('*').remove()
      svg.attr('viewBox', `0 0 ${width} ${height}`)

      const defs = svg.append('defs')
      defs
        .append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', STROKE_COLOR)

      const layersInUse = Array.from(
        new Set(nodes.map((n) => n.layer)),
      ).sort((a, b) => a - b)
      const layerCount = layersInUse.length || 1
      const padX = 70
      const columnWidth = (width - padX * 2) / Math.max(1, layerCount - 1)
      const layerX = (layer: number) => {
        const idx = layersInUse.indexOf(layer)
        if (layerCount === 1) return width / 2
        return padX + idx * columnWidth
      }

      const verticalPad = 60
      const grouped: Record<number, GraphNode[]> = {}
      nodes.forEach((n) => {
        grouped[n.layer] = grouped[n.layer] || []
        grouped[n.layer].push(n)
      })
      Object.values(grouped).forEach((layerNodes) => {
        const step =
          layerNodes.length > 1
            ? (height - verticalPad * 2) / (layerNodes.length - 1)
            : 0
        layerNodes.forEach((node, i) => {
          node.x = layerX(node.layer)
          node.y =
            layerNodes.length === 1 ? height / 2 : verticalPad + i * step
          node.fx = node.x
          node.fy = node.y
        })
      })

      const sim = d3
        .forceSimulation<GraphNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(links)
            .id((d) => d.id)
            .distance(100)
            .strength(0.3),
        )
        .force('collide', d3.forceCollide<GraphNode>(NODE_RADIUS + 10))
        .stop()
      for (let i = 0; i < 120; i++) sim.tick()
      nodes.forEach((n) => {
        if (n.x == null || n.y == null) return
        n.fx = n.x
        n.fy = n.y
      })

      // Edges (slate gray with white arrowheads)
      const linkGroup = svg.append('g').attr('class', 'links')
      linkGroup
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', EDGE_COLOR)
        .attr('stroke-width', 1)
        .attr('marker-end', 'url(#arrow)')
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)

      // Edge amount labels
      svg
        .append('g')
        .attr('class', 'edge-labels')
        .selectAll('text')
        .data(links)
        .enter()
        .append('text')
        .attr('fill', '#A3A3A3')
        .style('font-size', '10px')
        .attr('text-anchor', 'middle')
        .attr('x', (d) => {
          const sx = (d.source as GraphNode).x ?? 0
          const tx = (d.target as GraphNode).x ?? 0
          return (sx + tx) / 2
        })
        .attr('y', (d) => {
          const sy = (d.source as GraphNode).y ?? 0
          const ty = (d.target as GraphNode).y ?? 0
          return (sy + ty) / 2 - 6
        })
        .text((d) => formatRupee(d.amount))

      // Nodes
      const nodeGroup = svg.append('g').attr('class', 'nodes')
      const node = nodeGroup
        .selectAll('g.node')
        .data(nodes, (d) => (d as GraphNode).id)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${d.x},${d.y})`)

      node.each(function (d) {
        const g = d3.select(this)
        const fill = NODE_FILL[d.type]
        // Double ring for cash_out
        if (d.type === 'cash_out') {
          g.append('circle')
            .attr('r', NODE_RADIUS + 6)
            .attr('fill', 'none')
            .attr('stroke', STROKE_COLOR)
            .attr('stroke-width', 1)
          g.append('circle')
            .attr('r', NODE_RADIUS + 2)
            .attr('fill', 'none')
            .attr('stroke', STROKE_COLOR)
            .attr('stroke-width', 1)
        }
        g.append('circle')
          .attr('r', NODE_RADIUS)
          .attr('fill', fill)
          .attr('stroke', STROKE_COLOR)
          .attr('stroke-width', d.type === 'mule' ? 2 : 1)
          .attr('stroke-dasharray', d.type === 'relay' ? '4 3' : null)
      })

      node
        .append('text')
        .text((d) => d.label)
        .attr('text-anchor', 'middle')
        .attr('y', NODE_RADIUS + 16)
        .attr('fill', STROKE_COLOR)
        .style('font-size', '11px')
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        draw(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    draw(containerRef.current.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [networkConnections, height])

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-col border border-border bg-background p-7"
    >
      <h3 className="text-xs font-medium uppercase tracking-widest text-foreground-muted">
        Fraud Ring Network
      </h3>
      <svg
        ref={svgRef}
        className="mt-4 w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      />
      <div className="mt-4 flex flex-row items-center gap-6 text-xs text-foreground-muted">
        <span className="flex flex-row items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_FILL.victim }}
          />
          Victim
        </span>
        <span className="flex flex-row items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_FILL.mule }}
          />
          Mule
        </span>
        <span className="flex flex-row items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_FILL.relay }}
          />
          Relay
        </span>
        <span className="flex flex-row items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_FILL.cash_out }}
          />
          Cash-Out
        </span>
      </div>
    </div>
  )
}

export default NetworkGraph
