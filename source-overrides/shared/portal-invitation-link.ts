export function parsePortalInvitationLink(
  link: string,
  kind: "ies" | "master" | "experience",
) {
  const url = new URL(link);
  if (
    url.origin !== "https://www.verticesuperior.com.br" &&
    url.origin !== "https://verticesuperior.com.br"
  )
    throw Error("invitation_origin_invalid");
  if (url.search) throw Error("invitation_query_invalid");
  let id = "",
    token = "";
  if (kind === "experience") {
    if (url.pathname !== "/experience") throw Error("invitation_path_invalid");
    const match = /^#convite=([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(
      url.hash,
    );
    if (!match) throw Error("invitation_invalid");
    id = match[1];
    token = match[2];
  } else {
    if (url.pathname !== "/master") throw Error("invitation_path_invalid");
    const p = new URLSearchParams(url.hash.slice(1)),
      key = kind === "master" ? "master" : "ies",
      idKey = key + "_invitation",
      tokenKey = key + "_token";
    if (
      [...p.keys()].length !== 2 ||
      p.getAll(idKey).length !== 1 ||
      p.getAll(tokenKey).length !== 1
    )
      throw Error("invitation_invalid");
    id = p.get(idKey) || "";
    token = p.get(tokenKey) || "";
    if (
      !(kind === "master" ? /^[A-Za-z0-9_-]{43}$/ : /^[a-f0-9]{64}$/).test(
        token,
      )
    )
      throw Error("invitation_token_invalid");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw Error("invitation_id_invalid");
  return { id, token };
}
