'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { AdminCategory, adminApi } from '../../../lib/admin-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CategoryTreeProps {
  categories: AdminCategory[];
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
}

function CategoryNode({
  category,
  children,
  onEdit,
  onDelete,
}: {
  category: AdminCategory;
  children: AdminCategory[];
  onEdit: (c: AdminCategory) => void;
  onDelete: (c: AdminCategory) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => adminApi.categories.update(category.id, { isActive: !category.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success(`Category ${category.isActive ? 'deactivated' : 'activated'}`);
    },
    onError: () => toast.error('Failed to update category'),
  });

  return (
    <div className="select-none">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 group">
        <button
          className="w-4 h-4 flex items-center justify-center text-slate-400"
          onClick={() => hasChildren && setExpanded((e) => !e)}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-3.5 h-3.5 inline-block border-l-2 border-b-2 border-slate-200 ml-1 mb-1" />
          )}
        </button>
        <span className="flex-1 text-sm font-medium text-slate-800">{category.name}</span>
        {(category._count?.products ?? 0) > 0 && (
          <Badge variant="outline" className="text-xs text-slate-500">
            {category._count?.products}
          </Badge>
        )}
        {!category.isActive && (
          <Badge className="bg-red-100 text-red-600 text-xs border-red-200 border">Inactive</Badge>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 p-0 ${category.isActive ? 'text-green-600 hover:text-green-800' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            title={category.isActive ? 'Deactivate' : 'Activate'}
          >
            {category.isActive
              ? <ToggleRight className="w-4 h-4" />
              : <ToggleLeft className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(category)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="ml-7 pl-3 border-l border-slate-200">
          {children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              children={[]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ categories, onEdit, onDelete }: CategoryTreeProps) {
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No categories yet. Create one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {roots.map((cat) => (
        <CategoryNode
          key={cat.id}
          category={cat}
          children={childrenOf(cat.id)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
