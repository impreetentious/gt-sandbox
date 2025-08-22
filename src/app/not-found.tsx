import { StubPage } from "@/components/stub-page";

export default function NotFound() {
  return (
    <StubPage
      eyebrow="404"
      title="This payoff does not exist."
      summary="The route is not part of the static export. Return to the sandbox to choose a valid path."
    />
  );
}
