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
