import Navbar from '@/components/Navbar/Navbar';
import { SearchSkeletonPage } from '@/components/RouteSkeleton/RouteSkeleton';

export default function Loading() {
  return (
    <>
      <Navbar />
      <SearchSkeletonPage />
    </>
  );
}
