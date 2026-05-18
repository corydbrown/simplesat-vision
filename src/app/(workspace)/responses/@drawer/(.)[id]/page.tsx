import { notFound } from "next/navigation";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { ResponseDetailBody } from "@/components/responses/response-detail";
import { getResponseById } from "@/db/queries/responses";

export default async function ResponseDrawer(
  props: PageProps<"/responses/[id]">,
) {
  const { id } = await props.params;
  const response = await getResponseById(id);
  if (!response) notFound();

  return (
    <DetailDrawer closeHref="/responses">
      <ResponseDetailBody response={response} />
    </DetailDrawer>
  );
}
