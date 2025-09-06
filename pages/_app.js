// /pages/_app.js
import * as React from 'react';
import Head from 'next/head';
import PropTypes from 'prop-types';
import { AppCacheProvider } from '@mui/material-nextjs/v14-pagesRouter';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import theme from '@/theme';
import AuthProvider from '@/providers/AuthProvider';
import '@/styles/globals.css';

export default function MyApp(props) {
  const { Component, pageProps } = props;

  return (
    <AppCacheProvider>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <title>Shafy Doctor</title>

        {/* Favicon / tab icon */}
        <link rel="icon" href="/logo.ico" />
        <link rel="shortcut icon" href="/logo.ico" />

        {/* Optional: better OS integration using the same icon */}
        <link rel="apple-touch-icon" href="/logo.ico" />
        <meta name="theme-color" content="#1976d2" />
        <meta name="application-name" content="Shafy Doctor" />
        <meta name="msapplication-TileImage" content="/logo.ico" />
        <meta name="msapplication-TileColor" content="#1976d2" />
      </Head>

      <ThemeProvider theme={createTheme(theme)}>
        <CssBaseline />
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
