import { readFileSync } from "node:fs";
import path from "node:path";

const TERMINATORS_LOGO_CID = "terminators-logo@jobflow";
const JOBFLOW_LOGO_CID = "jobflow-logo@jobflow";
const assetsDirectory = path.resolve(process.cwd(), "attached_assets");

const readLogo = (filename: string) =>
  readFileSync(path.join(assetsDirectory, filename)).toString("base64");

const terminatorsLogo = readLogo("termlogobig_1775739810095.jpg");
const jobFlowLogo = readLogo("job-flow-header-logo_1779307679615.png");

export const EMAIL_BRANDING_MARKER = `cid:${TERMINATORS_LOGO_CID}`;

export const EMAIL_BRANDING_HTML = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
    <tr>
      <td style="padding:0 16px 0 0;vertical-align:middle;">
        <img src="cid:${TERMINATORS_LOGO_CID}" alt="The Terminators" width="180" style="display:block;width:180px;height:auto;border:0;">
      </td>
      <td style="padding:0;vertical-align:middle;">
        <img src="cid:${JOBFLOW_LOGO_CID}" alt="JobFlow Field Service Management" width="140" style="display:block;width:140px;height:auto;border:0;">
      </td>
    </tr>
  </table>
`;

export const EMAIL_BRANDING_SENDGRID_ATTACHMENTS = [
  {
    content: terminatorsLogo,
    filename: "terminators-logo.jpg",
    type: "image/jpeg",
    disposition: "inline",
    content_id: TERMINATORS_LOGO_CID,
  },
  {
    content: jobFlowLogo,
    filename: "jobflow-logo.png",
    type: "image/png",
    disposition: "inline",
    content_id: JOBFLOW_LOGO_CID,
  },
] as const;

export const EMAIL_BRANDING_SMTP_ATTACHMENTS = [
  {
    filename: "terminators-logo.jpg",
    content: Buffer.from(terminatorsLogo, "base64"),
    contentType: "image/jpeg",
    contentDisposition: "inline",
    cid: TERMINATORS_LOGO_CID,
  },
  {
    filename: "jobflow-logo.png",
    content: Buffer.from(jobFlowLogo, "base64"),
    contentType: "image/png",
    contentDisposition: "inline",
    cid: JOBFLOW_LOGO_CID,
  },
] as const;

export function withEmailBranding(html: string): string {
  if (!html || html.includes(EMAIL_BRANDING_MARKER)) return html;
  const bodyTag = /<body([^>]*)>/i;
  if (bodyTag.test(html)) {
    return html.replace(bodyTag, `<body$1>${EMAIL_BRANDING_HTML}`);
  }
  return `${EMAIL_BRANDING_HTML}${html}`;
}