import { TLocalizeFn } from "@renderer/stores/useLocaleStore";

export function localizeChannelName(channelName: string, t: TLocalizeFn): string {
    if (channelName === "Experimental") return t("channel.experimental");
    if (channelName === "Stable") return t("channel.stable");
    if (channelName === "Custom") return t("channel.custom");
    return channelName;
}
