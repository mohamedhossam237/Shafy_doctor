// components/doctor/profile/OverviewSection.jsx
import { Grid, Typography, Stack, Button } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import ApartmentIcon from "@mui/icons-material/Apartment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WorkIcon from "@mui/icons-material/Work";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import EditIcon from "@mui/icons-material/Edit";
import SectionCard from "./SectionCard";
import InfoTile from "./InfoTile";

export default function OverviewSection({ doctor, isArabic, onEdit }) {
  const t = (en, ar) => (isArabic ? ar : en);

  return (
    <SectionCard
      id="overview"
      icon={<PersonIcon />}
      title={t("Overview", "نظرة عامة")}
      rtl={isArabic}
      action={
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<EditIcon />}
          onClick={onEdit}
          sx={{ borderRadius: 3, textTransform: "none" }}
        >
          {t("Edit", "تعديل")}
        </Button>
      }
    >
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <InfoTile
            icon={<PersonIcon />}
            title={t("Bio", "نبذة")}
            value={doctor[isArabic ? "bio_ar" : "bio_en"]}
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <InfoTile
            icon={<SchoolIcon />}
            title={t("Qualifications", "المؤهل العلمي")}
            value={doctor[isArabic ? "qualifications_ar" : "qualifications_en"]}
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <InfoTile
            icon={<ApartmentIcon />}
            title={t("University", "الجامعة")}
            value={doctor[isArabic ? "university_ar" : "university_en"]}
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <InfoTile
            icon={<CalendarMonthIcon />}
            title={t("Graduation Year", "سنة التخرج")}
            value={doctor?.graduationYear}
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <InfoTile
            icon={<WorkIcon />}
            title={t("Experience", "سنوات الخبرة")}
            value={
              doctor?.experienceYears != null
                ? `${doctor.experienceYears} ${t("years", "سنوات")}`
                : ""
            }
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <InfoTile
            icon={<MonetizationOnIcon />}
            title={t("Checkup Price", "سعر الكشف")}
            value={
              doctor?.checkupPrice != null
                ? `${doctor.checkupPrice} ${t("EGP", "جنيه")}`
                : ""
            }
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <InfoTile
            icon={<PhoneIcon />}
            title={t("Phone", "رقم الهاتف")}
            value={doctor?.phone}
            rtl={isArabic}
          />
        </Grid>
        <Grid item xs={12}>
          <InfoTile
            icon={<VerifiedUserIcon />}
            title={t("Profile Completed", "الحساب مكتمل؟")}
            value={
              doctor?.profileCompleted === true ? t("Yes", "نعم") : t("No", "لا")
            }
            rtl={isArabic}
          />
        </Grid>
      </Grid>
    </SectionCard>
  );
}
