import { Paper, Stack, Typography, Button } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function EmptyPrompt({ rtl, text, actionLabel, onAction }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        textAlign: "center",
        bgcolor: "rgba(250,250,250,0.7)",
      }}
    >
      <Stack spacing={1.2} alignItems="center">
        <InfoOutlinedIcon color="disabled" fontSize="large" />
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
        {onAction && (
          <Button variant="contained" size="small" onClick={onAction} sx={{ borderRadius: 2 }}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
