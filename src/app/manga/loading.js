import Navbar from '@/components/Navbar/Navbar';
import { HomeSkeletonPage } from '@/components/RouteSkeleton/RouteSkeleton';

export default function Loading() {
  return (
    <>
      <Navbar />
      <HomeSkeletonPage />
    </>
  );
}
