// /pages/ask-shafy.js
'use client';
import * as React from 'react';
import { Container } from '@mui/material';
import AppLayout from '@/components/AppLayout';
import AskShafyChat from '@/components/AskShafy/AskShafyChat';

export default function AskShafyPage() {
  // Arabic as the default UI language
  const isArabic = true;

  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ my: 2 }}>
        <AskShafyChat isArabic={isArabic} />
      </Container>
    </AppLayout>
  );
}
