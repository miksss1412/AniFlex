import Navbar from '@/components/Navbar/Navbar';
import { DetailSkeletonPage } from '@/components/RouteSkeleton/RouteSkeleton';
import ScrollToTopOnMount from '@/components/ScrollToTopOnMount/ScrollToTopOnMount';

export default function Loading() {
  return (
    <>
      <ScrollToTopOnMount />
      <Navbar />
      <DetailSkeletonPage />
    </>
  );
}
