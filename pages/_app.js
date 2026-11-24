// /pages/_app.js
import * as React from 'react';
import Head from 'next/head';
import Router from 'next/router';
import PropTypes from 'prop-types';
import { AppCacheProvider } from '@mui/material-nextjs/v14-pagesRouter';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '@/theme';
import AuthProvider from '@/providers/AuthProvider';
import '@/styles/globals.css';

function RouteProgressBar() {
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let timer = null;
    const handleStart = () => {
      clearTimeout(timer);
      setVisible(true);
      setProgress(35);
      timer = setTimeout(() => setProgress(75), 140);
    };
    const handleDone = () => {
      clearTimeout(timer);
      setProgress(100);
      timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    };

    Router.events.on('routeChangeStart', handleStart);
    Router.events.on('routeChangeComplete', handleDone);
    Router.events.on('routeChangeError', handleDone);

    return () => {
      clearTimeout(timer);
      Router.events.off('routeChangeStart', handleStart);
      Router.events.off('routeChangeComplete', handleDone);
      Router.events.off('routeChangeError', handleDone);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 50%, #4f46e5 100%)',
          boxShadow: '0 0 12px rgba(37, 99, 235, 0.75)',
          transition: 'width 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

export default function MyApp(props) {
  const { Component, pageProps } = props;

  return (
    <AppCacheProvider>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <title>Shafy Doctor | بوابة الطبيب الذكية</title>

        {/* Favicon / tab icon */}
        <link rel="icon" href="/logo.ico" />
        <link rel="shortcut icon" href="/logo.ico" />

        {/* Better OS integration */}
        <link rel="apple-touch-icon" href="/logo.ico" />
        <meta name="theme-color" content="#1d4ed8" />
        <meta name="application-name" content="Shafy Doctor" />
        <meta name="msapplication-TileImage" content="/logo.ico" />
        <meta name="msapplication-TileColor" content="#1d4ed8" />
      </Head>

      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouteProgressBar />
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ThemeProvider>
    </AppCacheProvider>
  );
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
};
