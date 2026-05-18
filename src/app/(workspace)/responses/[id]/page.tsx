import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { ResponseDetailBody } from "@/components/responses/response-detail";
import { getResponseById } from "@/db/queries/responses";
import type { ResponseListRow } from "@/db/queries/responses";

export default async function ResponseDetailPage(
  props: PageProps<"/responses/[id]">,
) {
  const { id } = await props.params;
  const response = await getResponseById(id);
  if (!response) notFound();

  const responseRow: ResponseListRow = {
    id: response.id,
    rating: response.rating,
    scale: response.scale,
    comment: response.comment,
    respondedAt: response.respondedAt,
    answers: response.answers,
    ticketId: response.ticket?.id ?? null,
    ticketSubject: response.ticket?.subject ?? null,
    ticketExternalId: response.ticket?.externalId ?? null,
    customerId: response.customer?.id ?? null,
    customerName: response.customer?.name ?? null,
    teamMemberId: response.agent?.id ?? null,
    teamMemberName: response.agent?.name ?? null,
    teamMemberAvatarColor: response.agent?.avatarColor ?? null,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Responses", href: "/responses" },
          { label: `${response.rating}/${response.scale}` },
        ]}
      />
      <ResponseDetailBody response={response} responseRow={responseRow} />
    </>
  );
}
