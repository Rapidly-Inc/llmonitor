import { useApps, useCurrentApp } from "@/utils/supabaseHooks"
import {
  Header,
  Anchor,
  Button,
  Flex,
  Group,
  Text,
  Select,
} from "@mantine/core"
import { useLocalStorage } from "@mantine/hooks"

import { IconAnalyze, IconHelp, IconMessage } from "@tabler/icons-react"
import Image from "next/image"

import Link from "next/link"

export default function Navbar() {
  const { apps } = useApps()

  const { app, setAppId, loading } = useCurrentApp()

  return (
    <Header height={60} p="md">
      <Flex align="center" justify="space-between" h="100%">
        <Group>
          <Anchor component={Link} href="/">
            <Group spacing="sm">
              <IconAnalyze />
              <Text weight="bold">LLMonitor</Text>
            </Group>
          </Anchor>

          {!loading && (
            <Select
              size="xs"
              placeholder="Select an app"
              value={app?.id}
              onChange={(value) => setAppId(value)}
              data={apps?.map((app) => ({ value: app.id, label: app.name }))}
            />
          )}
        </Group>

        <Group>
          <Button size="xs" variant="outline" leftIcon={<IconHelp size={18} />}>
            Help
          </Button>

          <Button size="xs" leftIcon={<IconMessage size={18} />}>
            Feedback
          </Button>
        </Group>
      </Flex>
    </Header>
  )
}
