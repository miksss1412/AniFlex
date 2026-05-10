import Navbar from '@/components/Navbar/Navbar';
import { DetailSkeletonPage } from '@/components/RouteSkeleton/RouteSkeleton';

export default function Loading() {
  return (
    <>
      <Navbar />
      <DetailSkeletonPage />
    </>
  );
}
