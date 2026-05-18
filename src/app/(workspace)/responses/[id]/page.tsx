import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { ResponseDetailBody } from "@/components/responses/response-detail";
import { getResponseById } from "@/db/queries/responses";

export default async function ResponseDetailPage(
  props: PageProps<"/responses/[id]">,
) {
  const { id } = await props.params;
  const response = await getResponseById(id);
  if (!response) notFound();

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Responses", href: "/responses" },
          { label: `${response.rating}/${response.scale}` },
        ]}
      />
      <ResponseDetailBody response={response} />
    </>
  );
}
