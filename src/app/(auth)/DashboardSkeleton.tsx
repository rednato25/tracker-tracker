// src/app/(auth)/DashboardSkeleton.tsx

import { Shimmer } from "@/components/ui"

function DashboardSkeleton() {
  return (
    <div className="min-h-full">
      <div className="mb-4 flex h-12 items-center justify-between border-b border-border">
        <Shimmer size="text" className="w-36" />
        <div className="flex items-center gap-2">
          <Shimmer className="h-8 w-20" rounded="sm" />
          <Shimmer className="h-8 w-24" rounded="sm" />
          <Shimmer className="h-8 w-8" rounded="sm" />
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-12">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={`total-${i}`} className="min-h-[116px] border border-border bg-raised p-3.5">
              <Shimmer size="label" className="w-20" />
              <Shimmer size="value" className="mt-2 w-24" />
              <Shimmer size="text" className="mt-2 w-28" />
            </div>
          ))}
        </div>

        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <Shimmer size="value" className="w-44" />
            <Shimmer size="text" className="w-52" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={`card-${i}`} className="flex min-h-[300px] flex-col gap-3 border border-border bg-raised p-4">
              <div className="flex items-center gap-2">
                <Shimmer rounded="full" className="h-3 w-3" />
                <Shimmer size="text" className="w-36" />
              </div>
              <Shimmer size="text" className="w-24" />
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                {Array.from({ length: 6 }, (_, j) => (
                  <div key={`metric-${i}-${j}`} className="flex flex-col gap-1">
                    <Shimmer size="label" className="w-16" />
                    <Shimmer size="text" className="w-20" />
                  </div>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
                <Shimmer size="text" className="w-28" />
                <Shimmer className="h-1.5 w-full" rounded="sm" />
                <Shimmer className="h-1.5 w-full" rounded="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { DashboardSkeleton }
