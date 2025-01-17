import { NextSeo } from "next-seo"
import Router from "next/router"
import { useMemo, useState } from "react"

import DataTable from "@/components/Blocks/DataTable"
import Feedback from "@/components/Blocks/Feedback"
import AppUserAvatar from "@/components/Blocks/AppUserAvatar"
import { BubbleMessage } from "@/components/Blocks/SmartViewer/Message"
import Empty from "@/components/Layout/Empty"

import {
  durationColumn,
  feedbackColumn,
  inputColumn,
  tagsColumn,
  timeColumn,
  userColumn,
} from "@/utils/datatable"

import { formatDateTime } from "@/utils/format"
import {
  useAllFeedbacks,
  useAppUser,
  useConvosByFeedback,
  useRuns,
} from "@/utils/dataHooks"

import {
  Button,
  Card,
  Drawer,
  Flex,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core"

import { IconMessages, IconNeedleThread } from "@tabler/icons-react"
import analytics from "../../utils/analytics"
import FacetedFilter from "../../components/Blocks/FacetedFilter"

const columns = [
  timeColumn("created_at"),
  durationColumn("full"),
  userColumn(),
  inputColumn("Opening Message"),
  tagsColumn(),
  feedbackColumn(true),
]

const ChatReplay = ({ run }) => {
  const { runs, loading } = useRuns("chat", {
    match: { parent_run: run.id },
    notInfinite: true,
  })

  const { user } = useAppUser(run.user)

  console.log("runs", runs)

  // Each chat run has input = user message, output = bot message
  const messages = useMemo(
    () =>
      runs
        ?.filter((run) => run.type === "chat")
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .map((run) => {
          return [
            typeof run.input === "string"
              ? {
                  role: "user",
                  content: run.input,
                  timestamp: run.created_at,
                  feedback: run.feedback,
                }
              : run.input,
            typeof run.output === "string"
              ? {
                  role: "assistant",
                  content: run.output,
                  took:
                    new Date(run?.ended_at).getTime() -
                    new Date(run?.created_at).getTime(),
                  timestamp: run.ended_at,
                  feedback: run.feedback,
                }
              : run.output,
          ].filter(Boolean)
        })
        .flat(),
    [runs],
  )

  return (
    <Stack>
      <Card withBorder radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text>User</Text>
            <Text>
              {user ? (
                <AppUserAvatar size="sm" user={user} withName />
              ) : (
                "Unknown"
              )}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text>First message</Text>
            <Text>{formatDateTime(run.created_at)}</Text>
          </Group>
          <Group justify="space-between">
            <Text>Last message</Text>
            <Text>{formatDateTime(run.ended_at)}</Text>
          </Group>
          <Group justify="space-between">
            <Text>Messages</Text>
            <Text>{messages?.length}</Text>
          </Group>
        </Stack>
      </Card>
      <Button
        variant="outline"
        onClick={() => {
          Router.push(`/traces/${run.id}`)
        }}
        rightSection={<IconNeedleThread size="16" />}
      >
        View trace
      </Button>

      <Title order={3}>Replay</Title>

      {messages && (
        <Stack gap={0}>
          {messages?.map(({ role, content, took, feedback }) => (
            <>
              <BubbleMessage
                role={role}
                content={content}
                extra={
                  <>
                    {took && (
                      <Text c="dimmed" size="xs">
                        {took}ms
                      </Text>
                    )}

                    {feedback && <Feedback data={feedback} />}
                  </>
                }
              />
            </>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export default function Chats() {
  const [selected, setSelected] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])

  let { runs, loading, validating, loadMore } = useRuns(null, {
    filter: ["type", "in", '("convo","thread")'],
  })

  const { allFeedbacks } = useAllFeedbacks()
  const { runIds } = useConvosByFeedback(selectedItems)

  // TODO: filter in query directly
  runs = runs?.filter((run) => {
    if (runIds?.length) {
      if (runIds.includes(run.id)) {
        return true
      }
      return false
    }
    return true
  })

  if (!loading && runs?.length === 0) {
    return <Empty Icon={IconMessages} what="conversations" />
  }

  // TODO: change the format of feedback. It should be of the form: {type: 'thumb' | 'rating' ..., value: 'UP' | 'DOWN' ...}
  // + explain why to Vince
  return (
    <Stack h={"calc(100vh - var(--navbar-size))"}>
      <NextSeo title="Chats" />
      <Flex justify="space-between">
        <Group>
          {/* <SearchBar query={query} setQuery={setQuery} /> */}

          {allFeedbacks?.length && (
            <FacetedFilter
              name="Feedbacks"
              items={allFeedbacks}
              render={(item) => <Feedback data={item} />}
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
              withSearch={false}
            />
          )}
        </Group>
      </Flex>
      {loading && <Loader />}

      <Drawer
        opened={!!selected}
        keepMounted
        size="lg"
        position="right"
        title={<Title order={3}>Chat details</Title>}
        onClose={() => setSelected(null)}
      >
        {selected && <ChatReplay run={selected} />}
      </Drawer>

      <DataTable
        key="chat"
        onRowClicked={(row) => {
          analytics.trackOnce("OpenChat")
          setSelected(row)
        }}
        loading={loading || validating}
        loadMore={loadMore}
        columns={columns}
        data={runs}
      />
    </Stack>
  )
}
