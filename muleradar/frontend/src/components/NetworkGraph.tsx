import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

type NodeType = 'victim' | 'mule' | 'relay' | 'cashout'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: NodeType
  layer: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

const NODES: GraphNode[] = [
  { id: 'V1', label: 'Victim', type: 'victim', layer: 0 },
  { id: 'M1', label: 'Mule A', type: 'mule', layer: 1 },
  { id: 'M2', label: 'Mule B', type: 'mule', layer: 1 },
  { id: 'R1', label: 'Relay', type: 'relay', layer: 2 },
  { id: 'M3', label: 'Mule C', type: 'mule', layer: 3 },
  { id: 'C1', label: 'Cash-Out', type: 'cashout', layer: 4 },
]

const LINKS: GraphLink[] = [
  { source: 'V1', target: 'M1' },
  { source: 'V1', target: 'M2' },
  { source: 'M1', target: 'R1' },
  { source: 'M2', target: 'R1' },
  { source: 'R1', target: 'M3' },
  { source: 'M3', target: 'C1' },
]

const SVG_HEIGHT = 300
const NODE_RADIUS = 16

function NetworkGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const draw = (width: number) => {
      svg.selectAll('*').remove()
      svg.attr('viewBox', `0 0 ${width} ${SVG_HEIGHT}`)

      // Arrowhead marker — white, triangle, refX positioned so the tip
      // lands at the edge of the destination circle.
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
        .attr('fill', '#FFFFFF')

      // Layer x-positions: split width into 5 columns (one per layer).
      const padX = 60
      const layerCount = 5
      const columnWidth = (width - padX * 2) / (layerCount - 1)
      const layerX = (layer: number) => padX + layer * columnWidth

      // Group nodes by layer, then stack vertically within each layer.
      const layers: GraphNode[][] = Array.from({ length: layerCount }, () => [])
      NODES.forEach((n) => {
        const idx = Math.max(0, Math.min(layerCount - 1, n.layer))
        layers[idx].push(n)
      })
      const verticalPad = 70
      layers.forEach((layerNodes) => {
        const step =
          layerNodes.length > 1
            ? (SVG_HEIGHT - verticalPad * 2) / (layerNodes.length - 1)
            : 0
        layerNodes.forEach((node, i) => {
          node.x = layerX(node.layer)
          node.y =
            layerNodes.length === 1
              ? SVG_HEIGHT / 2
              : verticalPad + i * step
          node.fx = node.x
          node.fy = node.y
        })
      })

      // Clone node/link arrays so D3's simulation can mutate them safely.
      const nodes: GraphNode[] = NODES.map((n) => ({ ...n }))
      const links: GraphLink[] = LINKS.map((l) => ({
        source: l.source,
        target: l.target,
      }))

      // Edges drawn first so nodes sit on top of the line ends.
      const linkGroup = svg.append('g').attr('class', 'links')
      const link = linkGroup
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1)
        .attr('marker-end', 'url(#arrow)')

      const nodeGroup = svg.append('g').attr('class', 'nodes')
      const node = nodeGroup
        .selectAll('g.node')
        .data(nodes, (d) => (d as GraphNode).id)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${d.x},${d.y})`)

      // Per-type visual: cashout draws an outer concentric ring; relay
      // gets a dashed stroke; mule gets a thicker stroke.
      node.each(function (d) {
        const g = d3.select(this)
        if (d.type === 'cashout') {
          g.append('circle')
            .attr('r', NODE_RADIUS + 5)
            .attr('fill', 'none')
            .attr('stroke', '#FFFFFF')
            .attr('stroke-width', 1)
        }
        g.append('circle')
          .attr('r', NODE_RADIUS)
          .attr('fill', '#000000')
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', d.type === 'mule' ? 2 : 1)
          .attr('stroke-dasharray', d.type === 'relay' ? '4 3' : null)
      })

      node
        .append('text')
        .text((d) => d.label)
        .attr('text-anchor', 'middle')
        .attr('y', NODE_RADIUS + 16)
        .attr('fill', '#FFFFFF')
        .style('font-size', '11px')

      // Run a brief force simulation so the fixed positions hold, but
      // the layout remains "settled" on first paint.
      const simulation = d3
        .forceSimulation<GraphNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(links)
            .id((d) => d.id)
            .distance(80)
            .strength(0.3),
        )
        .force('collide', d3.forceCollide<GraphNode>(NODE_RADIUS + 8))
        .stop()

      for (let i = 0; i < 120; i++) simulation.tick()

      nodes.forEach((n) => {
        if (n.x == null || n.y == null) return
        n.fx = n.x
        n.fy = n.y
      })

      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        draw(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    draw(containerRef.current.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-col border border-border bg-background p-6"
    >
      <h3 className="text-xs font-medium uppercase tracking-widest text-foreground-muted">
        Fraud Ring Network
      </h3>
      <svg
        ref={svgRef}
        className="mt-4 h-[300px] w-full"
        preserveAspectRatio="none"
      />
      <div className="mt-4 flex flex-row items-center gap-6 text-xs text-foreground-muted">
        <span className="flex flex-row items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full border border-foreground bg-foreground" />
          Victim
        </span>
        <span className="flex flex-row items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full border border-foreground" />
          Mule
        </span>
        <span className="flex flex-row items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-foreground border-dashed" />
          Relay
        </span>
        <span className="flex flex-row items-center gap-2">
          <span className="relative inline-block h-3 w-3">
            <span className="absolute inset-0 rounded-full border border-foreground" />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground" />
          </span>
          Cash-Out
        </span>
      </div>
    </div>
  )
}

export default NetworkGraph
