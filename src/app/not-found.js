// Component import
import Link from 'next/link';
import Navbar from '@/components/Navbar/Navbar';
import styles from './not-found.module.css';

export const metadata = { title: 'Not Found — AniFlex' };

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.code}>404</div>
          <h1 className={styles.title}>Anime Not Found</h1>
          <p className={styles.desc}>Looks like this anime escaped into another dimension.</p>
          <Link href="/" className="btn btn-primary" id="not-found-home">
            ▶ Go Back Home
          </Link>
        </div>
      </div>
    </>
  );
}
