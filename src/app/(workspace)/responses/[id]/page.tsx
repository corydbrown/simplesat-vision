import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { ResponseDetailBody } from "@/components/responses/response-detail";
import { DetailActions } from "@/components/shared/detail-actions";
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
    topics: response.topics,
    ticketId: response.ticket?.id ?? null,
    ticketSubject: response.ticket?.subject ?? null,
    ticketExternalId: response.ticket?.externalId ?? null,
    customerId: response.customer?.id ?? null,
    customerName: response.customer?.name ?? null,
    customerCompany: response.customer?.company ?? null,
    teamMemberId: response.teamMember?.id ?? null,
    teamMemberName: response.teamMember?.name ?? null,
    teamMemberAvatarColor: response.teamMember?.avatarColor ?? null,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Responses", href: "/responses" },
          { label: `${response.rating}/${response.scale}` },
        ]}
        actions={<DetailActions entityHref={`/responses/${response.id}`} />}
      />
      <ResponseDetailBody response={response} responseRow={responseRow} />
    </>
  );
}
