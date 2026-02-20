import React from "react";
import { router } from "expo-router";
import type { SectionComponentProps } from "@/cms/types";
import { Button, Card, SectionHeader } from "@/components";

export function WebEmbedSection({ section }: SectionComponentProps<any>) {
  return (
    <Card>
      <SectionHeader title={section.props.title} subtitle={section.props.url} />
      <Button
        label={section.props.buttonLabel ?? "Open"}
        onPress={() =>
          router.push({
            pathname: "/web-embed",
            params: { title: section.props.title, url: section.props.url }
          })
        }
      />
    </Card>
  );
}
