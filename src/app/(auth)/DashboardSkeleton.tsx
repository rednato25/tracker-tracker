// src/app/(auth)/DashboardSkeleton.tsx

import { Shimmer } from "@/components/ui"

function DashboardSkeleton() {
  return (
    <div className="min-h-full">
      <div className="-mx-4 -mt-4 mb-6 flex h-14 items-center justify-between border-b border-border bg-raised/80 pl-14 pr-4 md:-mx-6 md:-mt-6 md:pl-7 md:pr-7">
        <Shimmer size="text" className="w-36" />
        <div className="flex items-center gap-2">
          <Shimmer className="h-8 w-24" rounded="sm" />
          <Shimmer className="h-8 w-8" rounded="sm" />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 pb-12">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <Shimmer size="value" className="w-64" />
            <Shimmer size="text" className="w-52" />
          </div>
          <Shimmer className="h-8 w-40" rounded="sm" />
        </div>

        <div className="grid grid-cols-2 border-y border-border-emphasis bg-raised md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={`sum-${i}`} className="border-r border-border px-4 py-3 last:border-r-0">
              <Shimmer size="value" className="w-10" />
              <Shimmer size="label" className="mt-2 w-20" />
            </div>
          ))}
        </div>

        <div className="border border-border bg-raised">
          <div className="h-8 border-b border-border-emphasis bg-elevated" />
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={`row-${i}`}
              className="flex h-12 items-center gap-4 border-b border-border px-3 last:border-b-0"
            >
              <Shimmer rounded="full" className="h-3 w-3" />
              <Shimmer size="text" className="w-40" />
              <Shimmer size="text" className="ml-auto w-12" />
              <Shimmer size="text" className="w-16" />
              <Shimmer size="text" className="w-12" />
              <Shimmer size="text" className="w-20" />
            </div>
          ))}
        </div>

        <div className="grid border border-border bg-raised md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`foot-${i}`} className="border-r border-border px-4 py-3 last:border-r-0">
              <Shimmer size="label" className="w-24" />
              <div className="mt-3 flex flex-col gap-2">
                <Shimmer size="text" className="w-full" />
                <Shimmer size="text" className="w-4/5" />
                <Shimmer size="text" className="w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { DashboardSkeleton }
