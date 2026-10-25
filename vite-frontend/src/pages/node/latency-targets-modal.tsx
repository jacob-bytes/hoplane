import type { Node } from "@/pages/node/types";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pin } from "lucide-react";

import { getConfigByName, setNodeLatencyTargets } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/shadcn-bridge/heroui/button";
import { Checkbox } from "@/shadcn-bridge/heroui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@/shadcn-bridge/heroui/modal";
import {
  LATENCY_TARGETS_KEY,
  type LatencyTarget,
  parseLatencyTargets,
} from "@/utils/latency-targets";

const MAX_PINNED = 3;

/**
 * Chooses which reference points one or more nodes measure: the defaults,
 * or their own selection with up to three pinned for cards.
 */
export function LatencyTargetsModal({
  nodes,
  onClose,
  onSaved,
}: {
  /** Nodes being set; empty closes the dialog. */
  nodes: Node[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = nodes.length > 0;
  const batch = nodes.length > 1;

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "!w-[calc(100%-32px)] !mx-auto sm:!w-full rounded-xl overflow-hidden",
      }}
      isOpen={open}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onOpenChange={(v) => !v && onClose()}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold">
            {batch ? `为 ${nodes.length} 个服务器设置测试点` : "测试点"}
          </h2>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {nodes.map((n) => n.name).join("、")}
          </p>
        </ModalHeader>
        <ModalBody>
          <LatencyTargetsPanel
            nodes={nodes}
            onClose={onClose}
            onSaved={onSaved}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/** The point picker itself, usable inside another dialog. */
export function LatencyTargetsPanel({
  nodes,
  onClose,
  onSaved,
}: {
  nodes: Node[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pool, setPool] = useState<LatencyTarget[]>([]);
  const [custom, setCustom] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const open = nodes.length > 0;
  const batch = nodes.length > 1;

  useEffect(() => {
    if (!open) return;
    getConfigByName(LATENCY_TARGETS_KEY)
      .then((res) =>
        setPool(res.code === 0 ? parseLatencyTargets(res.data?.value) : []),
      )
      .catch(() => setPool([]));
    const own = !batch ? nodes[0].latencyTargets : null;

    setCustom(Boolean(own));
    setPoints(own?.points ?? []);
    setPinned(own?.pinned ?? []);
  }, [open, nodes, batch]);

  const defaults = pool.filter((t) => t.enabled);

  const startCustom = () => {
    if (points.length === 0) {
      setPoints(defaults.map((t) => t.name));
      setPinned(defaults.filter((t) => t.pinned).map((t) => t.name));
    }
    setCustom(true);
  };

  const toggle = (name: string, on: boolean) => {
    setPoints((prev) =>
      on ? [...prev, name] : prev.filter((n) => n !== name),
    );
    if (!on) setPinned((prev) => prev.filter((n) => n !== name));
  };

  const togglePin = (name: string) =>
    setPinned((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length < MAX_PINNED
          ? [...prev, name]
          : prev,
    );

  const save = async () => {
    setSaving(true);
    try {
      const res = await setNodeLatencyTargets({
        ids: nodes.map((n) => n.id),
        custom,
        points: pool.map((t) => t.name).filter((n) => points.includes(n)),
        pinned,
      });

      if (res.code !== 0) {
        toast.error(res.msg || "保存失败");

        return;
      }
      toast.success(batch ? `已设置 ${nodes.length} 个服务器` : "已保存");
      onSaved();
      onClose();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        className="w-fit self-start"
        size="sm"
        type="single"
        value={custom ? "custom" : "default"}
        variant="outline"
        onValueChange={(v) => {
          if (v === "custom") startCustom();
          else if (v === "default") setCustom(false);
        }}
      >
        <ToggleGroupItem value="default">跟随默认</ToggleGroupItem>
        <ToggleGroupItem value="custom">自定义</ToggleGroupItem>
      </ToggleGroup>

      {pool.length === 0 ? (
        <Empty className="border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Pin />
            </EmptyMedia>
            <EmptyTitle>还没有测试点</EmptyTitle>
            <EmptyDescription>先到网站配置里添加测试点。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !custom ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">
            测网站配置里打开“默认”的测试点，那边改了这里跟着变：
          </p>
          <div className="flex flex-wrap gap-1.5">
            {defaults.map((t) => (
              <Badge key={t.name} variant="secondary">
                {t.pinned && <Pin className="size-3" />}
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              已选 {points.length} 个 · 卡片显示 {pinned.length}/{MAX_PINNED}
            </span>
            <span className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setPoints(pool.map((t) => t.name))}
              >
                全选
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setPoints([]);
                  setPinned([]);
                }}
              >
                清空
              </Button>
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8">测试点</TableHead>
                  <TableHead className="h-8">地址</TableHead>
                  <TableHead className="h-8 text-right">卡片</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pool.map((t) => {
                  const on = points.includes(t.name);
                  const pin = pinned.includes(t.name);

                  return (
                    <TableRow key={t.name}>
                      <TableCell className="py-1.5">
                        <Checkbox
                          isSelected={on}
                          size="sm"
                          onValueChange={(v) => toggle(t.name, v)}
                        >
                          <span className="text-sm">{t.name}</span>
                        </Checkbox>
                      </TableCell>
                      <TableCell className="py-1.5 font-mono text-[11px] text-muted-foreground">
                        {t.host}:{t.port}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <Toggle
                          aria-label={`在卡片上固定 ${t.name}`}
                          disabled={
                            !on || (!pin && pinned.length >= MAX_PINNED)
                          }
                          pressed={pin}
                          size="sm"
                          variant="outline"
                          onPressedChange={() => togglePin(t.name)}
                        >
                          <Pin className="size-3" />
                          卡片
                        </Toggle>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {custom && pool.length > 0 && points.length === 0 && (
        <p className="text-xs text-muted-foreground">
          一个都不选：{batch ? "这些服务器" : "这台服务器"}
          不测延迟和回程，卡片上显示“不测延迟”。
        </p>
      )}

      {batch && (
        <Alert variant="warning">
          <AlertTitle>批量设置</AlertTitle>
          <AlertDescription>
            保存后会覆盖这些服务器原来的测试点设置。
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button variant="ghost" onPress={onClose}>
          取消
        </Button>
        <Button
          isDisabled={pool.length === 0}
          isLoading={saving}
          onPress={save}
        >
          保存
        </Button>
      </DialogFooter>
    </div>
  );
}
