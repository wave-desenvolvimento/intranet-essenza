export function coursePath(pageSlug: string) {
  return pageSlug === "universo-da-marca" ? "/cursos" : `/pagina/${pageSlug}`;
}
