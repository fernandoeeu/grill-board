import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invalidateTopicQueries } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { createTopicFn } from "@/server/functions/grill";

const FIELD_LABEL = "text-[11px] font-semibold tracking-[0.12em] uppercase text-stone-400";

const FIELD =
  "h-auto rounded-lg border-stone-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 placeholder:text-stone-300 focus-visible:border-accent-600 focus-visible:ring-1 focus-visible:ring-accent-600";

interface NewTopicDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTopicDialog({ isOpen, onOpenChange }: NewTopicDialogProps) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [categories, setCategories] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createTopic = useMutation({
    mutationFn: (input: { title: string; context?: string; categories: string[] }) =>
      createTopicFn({ data: input }),
    onSuccess: async (topic) => {
      reset();
      onOpenChange(false);
      toast("Topic created.");
      await invalidateTopicQueries(queryClient);
      await navigate({ to: "/topics/$topicId", params: { topicId: topic.id } });
    },
    onError: () => toast("Could not create the topic."),
  });

  function reset() {
    setTitle("");
    setContext("");
    setCategories("");
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || createTopic.isPending) return;
    const trimmedContext = context.trim();

    createTopic.mutate({
      title: trimmedTitle,
      ...(trimmedContext ? { context: trimmedContext } : {}),
      categories: categories
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} className="sm:max-w-md">
      <form onSubmit={handleSubmit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight text-stone-900">
            New topic
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-stone-500">
            One topic is one interrogation. Categories drive the order of the sections on its board.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="new-topic-title" className={FIELD_LABEL}>
            Title
          </Label>
          <Input
            id="new-topic-title"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What is under interrogation?"
            className={FIELD}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="new-topic-context" className={FIELD_LABEL}>
            Context
          </Label>
          <Input
            id="new-topic-context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="One line framing the subject (optional)"
            className={FIELD}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="new-topic-categories" className={FIELD_LABEL}>
            Categories
          </Label>
          <Textarea
            id="new-topic-categories"
            rows={4}
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            placeholder={"One per line, in order"}
            className={cn(FIELD, "min-h-24 resize-y")}
          />
        </div>

        <DialogFooter className="bg-stone-50">
          <DialogClose
            variant="outline"
            className="h-auto rounded-full border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50"
          >
            Cancel
          </DialogClose>
          <Button
            type="submit"
            isDisabled={!title.trim() || createTopic.isPending}
            className="h-auto rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            {createTopic.isPending ? "Creating…" : "Create topic"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
