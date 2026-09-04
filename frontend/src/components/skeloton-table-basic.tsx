import { Skeleton } from "./ui/skeleton";

export default function SkeletonTableBasic() {
  return (
    <div className="border rounded-lg w-full overflow-hidden">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
