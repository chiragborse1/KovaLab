import {
  describeBundledMetadataOnlyChannelCatalogContract,
  describeChannelCatalogEntryContract,
  describeOfficialFallbackChannelCatalogContract,
} from "../../../../test/helpers/channels/channel-catalog-contract.js";

describeChannelCatalogEntryContract({
  channelId: "msteams",
  npmSpec: "@kovaai/msteams",
  alias: "teams",
});

const metadataOnlyChannelMeta = {
  id: "metadata-only-channel",
  label: "Metadata Only Channel",
  selectionLabel: "Metadata Only Channel",
  detailLabel: "Metadata Only Channel",
  docsPath: "/channels/metadata-only-channel",
  blurb: "test-only metadata entry for bundled catalog discovery.",
};

describeBundledMetadataOnlyChannelCatalogContract({
  pluginId: "metadata-only-channel",
  packageName: "@kovaai/metadata-only-channel",
  npmSpec: "@kovaai/metadata-only-channel",
  meta: metadataOnlyChannelMeta,
  defaultChoice: "npm",
});

describeOfficialFallbackChannelCatalogContract({
  channelId: "whatsapp",
  npmSpec: "@kovaai/whatsapp",
  meta: {
    id: "whatsapp",
    label: "WhatsApp",
    selectionLabel: "WhatsApp (QR link)",
    detailLabel: "WhatsApp Web",
    docsPath: "/channels/whatsapp",
    blurb: "works with your own number; recommend a separate phone + eSIM.",
  },
  packageName: "@kovaai/whatsapp",
  pluginId: "whatsapp",
  externalNpmSpec: "@vendor/whatsapp-fork",
  externalLabel: "WhatsApp Fork",
});

describeChannelCatalogEntryContract({
  channelId: "wecom",
  npmSpec: "@wecom/wecom-kova-plugin@2026.4.23",
  alias: "wework",
});
