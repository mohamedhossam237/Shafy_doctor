// /pages/api/articles.js
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const articlesCol = collection(db, 'articles');
    
    let articles = [];
    
    // Try to get articles with orderBy first, but fall back if index is missing
    try {
      let articlesQuery;
      if (req.query.authorId) {
        articlesQuery = query(
          articlesCol, 
          where('authorId', '==', req.query.authorId),
          orderBy('publishedAt', 'desc'),
          limit(1000)
        );
      } else {
        articlesQuery = query(
          articlesCol,
          orderBy('publishedAt', 'desc'),
          limit(1000)
        );
      }
      
      const articlesSnap = await getDocs(articlesQuery);
      articles = articlesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (orderByError) {
      // If orderBy fails (index missing), use query without orderBy
      console.warn('Index missing for orderBy, falling back to simple query:', orderByError.message);
      
      let articlesQuery;
      if (req.query.authorId) {
        articlesQuery = query(
          articlesCol, 
          where('authorId', '==', req.query.authorId),
          limit(1000)
        );
      } else {
        articlesQuery = query(articlesCol, limit(1000));
      }
      
      const articlesSnap = await getDocs(articlesQuery);
      articles = articlesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    
    // Sort client-side by date (most recent first) as fallback
    articles.sort((a, b) => {
      const aDate = a.publishedAt?.toDate ? a.publishedAt.toDate() : 
                   a.publishedAt?.seconds ? new Date(a.publishedAt.seconds * 1000) :
                   a.createdAt?.toDate ? a.createdAt.toDate() :
                   a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) :
                   new Date(0);
      const bDate = b.publishedAt?.toDate ? b.publishedAt.toDate() : 
                   b.publishedAt?.seconds ? new Date(b.publishedAt.seconds * 1000) :
                   b.createdAt?.toDate ? b.createdAt.toDate() :
                   b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) :
                   new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
    
    return res.status(200).json({ success: true, articles });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch articles' });
  }
}
