import Navbar from '@/components/Navbar/Navbar';
import { WatchSkeletonPage } from '@/components/RouteSkeleton/RouteSkeleton';

export default function Loading() {
  return (
    <>
      <Navbar />
      <WatchSkeletonPage />
    </>
  );
}
