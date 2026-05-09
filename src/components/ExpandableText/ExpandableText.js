'use client';
import { useState, useRef, useEffect } from 'react';
import styles from './ExpandableText.module.css';

export default function ExpandableText({ html, maxHeight = 150 }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      setShouldShowButton(contentRef.current.scrollHeight > maxHeight);
    }
  }, [html, maxHeight]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className={styles.container}>
      <div 
        ref={contentRef}
        className={`${styles.content} ${isExpanded ? styles.expanded : ''}`}
        style={{ maxHeight: isExpanded ? 'none' : `${maxHeight}px` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      
      {shouldShowButton && (
        <button 
          onClick={toggleExpand} 
          className={styles.toggleBtn}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show Less' : 'Show More'}
          <svg 
            viewBox="0 0 24 24" 
            width="16" 
            height="16" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`${styles.icon} ${isExpanded ? styles.rotate : ''}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      )}
    </div>
  );
}
