import type { Metadata } from "next";
import { ClassroomExperience } from "@/components/classroom/classroom-experience";

export const metadata: Metadata = {
  title: "Classroom",
  description:
    "Build an assignment link that pins one exercise for a whole class, then aggregate the sessions students download — entirely on your device, with nothing uploaded.",
};

export default function ClassroomPage() {
  return <ClassroomExperience />;
}
