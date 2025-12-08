// /components/Profile/SocialLinks.jsx
import * as React from 'react';
import { Stack, Button, Link as MLink } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import LinkIcon from '@mui/icons-material/Link';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import YouTubeIcon from '@mui/icons-material/YouTube';
import TwitterIcon from '@mui/icons-material/Twitter';

export default function SocialLinks({ links = {}, rtl }) {
  const items = [
    { k: 'website', icon: <PublicIcon />, label: 'Website' },
    { k: 'booking', icon: <LinkIcon />, label: 'Booking' },
    { k: 'facebook', icon: <FacebookIcon />, label: 'Facebook' },
    { k: 'instagram', icon: <InstagramIcon />, label: 'Instagram' },
    { k: 'twitter', icon: <TwitterIcon />, label: 'Twitter' },
    { k: 'linkedin', icon: <LinkedInIcon />, label: 'LinkedIn' },
    { k: 'youtube', icon: <YouTubeIcon />, label: 'YouTube' },
  ].filter((x) => links?.[x.k]);
  if (items.length === 0) return null;

  return (
    <Stack direction={rtl ? 'row-reverse' : 'row'} spacing={1} flexWrap="wrap" useFlexGap>
      {items.map((x) => (
        <Button
          key={x.k}
          component={MLink}
          href={links[x.k]}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={x.icon}
          variant="outlined"
          size="small"
          sx={{ borderRadius: 2 }}
        >
          {x.label}
        </Button>
      ))}
    </Stack>
  );
}
