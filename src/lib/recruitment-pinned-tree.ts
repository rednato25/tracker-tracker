// src/lib/recruitment-pinned-tree.ts
//
// P54 view-model. Pinned routes are rendered as one tree per starting tracker.
// Paths that share a prefix share a branch, so a tracker appears once on that
// branch instead of once per pinned target.

export interface PinnedRouteStepInput {
  sourceTrackerId: string
  destinationTrackerId: string
  /** Days this hop adds to the wait to reach the destination. */
  waitDays: number | null
}

export interface PinnedRoutePathInput {
  targetTrackerId: string
  steps: PinnedRouteStepInput[]
}

export interface PinnedTreeNodeView {
  trackerId: string
  /** Cumulative wait to reach this node. Null when a hop's wait is unknown. */
  totalDays: number | null
  /** Set when this node is the destination of a pinned route. */
  pinnedTargetId: string | null
  /** Pinned targets below this node, including the node itself. */
  unlocks: number
  children: PinnedTreeNodeView[]
}

export interface PinnedRouteTreeView {
  sourceTrackerId: string
  pinnedCount: number
  root: PinnedTreeNodeView
}

export interface PinnedNextStepView {
  trackerId: string
  sourceTrackerId: string
  totalDays: number | null
}

export interface PinnedRouteTreesView {
  trees: PinnedRouteTreeView[]
  nextStep: PinnedNextStepView | null
}

interface BuildNode {
  trackerId: string
  totalDays: number | null
  pinnedTargetIds: Set<string>
  unlocks: number
  soonestPinnedDays: number | null
  children: BuildNode[]
}

function makeNode(trackerId: string, totalDays: number | null): BuildNode {
  return {
    trackerId,
    totalDays,
    pinnedTargetIds: new Set(),
    unlocks: 0,
    soonestPinnedDays: null,
    children: [],
  }
}

function addDays(total: number | null, hop: number | null): number | null {
  if (total === null || hop === null) return null
  return total + hop
}

/** Null means unknown, which sorts after every known wait. */
function soonestKnown(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.min(a, b)
}

function compareDays(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

function finalize(node: BuildNode): void {
  node.unlocks = node.pinnedTargetIds.size
  node.soonestPinnedDays = node.pinnedTargetIds.size > 0 ? node.totalDays : null

  for (const child of node.children) {
    finalize(child)
    node.unlocks += child.unlocks
    node.soonestPinnedDays = soonestKnown(node.soonestPinnedDays, child.soonestPinnedDays)
  }

  // Soonest pinned target first, then the node's own wait, then name.
  node.children.sort(
    (a, b) =>
      compareDays(a.soonestPinnedDays, b.soonestPinnedDays) ||
      compareDays(a.totalDays, b.totalDays) ||
      a.trackerId.localeCompare(b.trackerId)
  )
}

function toView(node: BuildNode): PinnedTreeNodeView {
  return {
    trackerId: node.trackerId,
    totalDays: node.totalDays,
    pinnedTargetId: node.pinnedTargetIds.values().next().value ?? null,
    unlocks: node.unlocks,
    children: node.children.map(toView),
  }
}

function compareNextSteps(a: PinnedNextStepView, b: PinnedNextStepView): number {
  return (
    compareDays(a.totalDays, b.totalDays) ||
    a.trackerId.localeCompare(b.trackerId) ||
    a.sourceTrackerId.localeCompare(b.sourceTrackerId)
  )
}

export function buildPinnedRouteTrees(paths: PinnedRoutePathInput[]): PinnedRouteTreesView {
  const roots = new Map<string, BuildNode>()
  const seenTargets = new Set<string>()

  for (const path of paths) {
    const first = path.steps[0]
    if (!first) continue
    // One pin per target. A duplicate would double-count unlock numbers.
    if (seenTargets.has(path.targetTrackerId)) continue
    seenTargets.add(path.targetTrackerId)

    const sourceTrackerId = first.sourceTrackerId
    let root = roots.get(sourceTrackerId)
    if (!root) {
      root = makeNode(sourceTrackerId, 0)
      roots.set(sourceTrackerId, root)
    }

    let node = root
    for (const step of path.steps) {
      let child = node.children.find(
        (candidate) => candidate.trackerId === step.destinationTrackerId
      )
      if (!child) {
        child = makeNode(step.destinationTrackerId, addDays(node.totalDays, step.waitDays))
        node.children.push(child)
      }
      node = child
    }
    node.pinnedTargetIds.add(path.targetTrackerId)
  }

  const trees: PinnedRouteTreeView[] = []
  let nextStep: PinnedNextStepView | null = null

  for (const root of roots.values()) {
    finalize(root)
    trees.push({
      sourceTrackerId: root.trackerId,
      pinnedCount: root.unlocks,
      root: toView(root),
    })

    const visit = (node: BuildNode) => {
      if (node.trackerId !== root.trackerId && node.unlocks > 0) {
        const candidate: PinnedNextStepView = {
          trackerId: node.trackerId,
          sourceTrackerId: root.trackerId,
          totalDays: node.totalDays,
        }
        if (!nextStep || compareNextSteps(candidate, nextStep) < 0) nextStep = candidate
      }
      for (const child of node.children) visit(child)
    }
    visit(root)
  }

  trees.sort((a, b) => a.sourceTrackerId.localeCompare(b.sourceTrackerId))

  return { trees, nextStep }
}
