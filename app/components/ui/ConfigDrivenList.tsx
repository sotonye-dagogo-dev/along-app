"use client";

import type { ReactNode } from "react";
import { AppEmptyState, AppPagination } from "./";
import type { EmptyStateConfig } from "@/app/lib/types";

interface PaginationConfig {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export interface ConfigDrivenListProps<T extends { id?: string }> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  loadingSkeleton?: ReactNode;
  emptyStateConfig?: EmptyStateConfig;
  pagination?: PaginationConfig;
}

function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 skeleton" />
      ))}
    </div>
  );
}

export function ConfigDrivenList<T extends { id?: string }>({
  items,
  renderItem,
  keyExtractor,
  isLoading = false,
  loadingSkeleton,
  emptyStateConfig,
  pagination,
}: ConfigDrivenListProps<T>) {
  if (isLoading) {
    return loadingSkeleton ?? <DefaultSkeleton />;
  }

  if (items.length === 0 && emptyStateConfig) {
    return (
      <AppEmptyState
        icon={emptyStateConfig.icon}
        title={emptyStateConfig.title}
        description={emptyStateConfig.description}
        actionLabel={emptyStateConfig.actionLabel}
        actionHref={emptyStateConfig.actionHref}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={keyExtractor(item)}>
          {renderItem(item, index)}
        </div>
      ))}
      {pagination && (
        <AppPagination
          current={pagination.current}
          total={pagination.total}
          pageSize={pagination.pageSize}
          onChange={pagination.onChange}
        />
      )}
    </div>
  );
}
