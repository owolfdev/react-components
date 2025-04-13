"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/utils/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface UploadedPhoto {
  url: string;
  caption?: string;
}

const supabase = createClient();

const SortablePhoto = ({
  id,
  index,
  photo,
  onRemove,
  onMoveUp,
  onMoveDown,
  onCaptionChange,
  isFirst,
  isLast,
}: {
  id: string;
  index: number;
  photo: UploadedPhoto;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCaptionChange: (caption: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative border p-2 rounded-md shadow-sm flex flex-col"
    >
      <div {...listeners} className="cursor-grab absolute top-1 left-1">
        <GripVertical
          size={26}
          className=" py-1 px-0 rounded-md shadow-sm bg-primary text-primary-foreground"
        />
      </div>

      <img
        src={photo.url}
        alt={`Uploaded Preview ${index + 1}`}
        className="w-full h-32 object-cover rounded-md"
      />

      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={onRemove}
        className="absolute top-1 right-1"
      >
        X
      </Button>

      <div className="flex justify-between items-center mt-2 space-x-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isFirst}
          onClick={onMoveUp}
        >
          ↑
        </Button>
        <Textarea
          placeholder="Enter caption (optional)"
          value={photo.caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          className="mt-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isLast}
          onClick={onMoveDown}
        >
          ↓
        </Button>
      </div>
    </div>
  );
};

const ImageUploader = ({
  onUpload,
  existingPhotos = [],
}: {
  onUpload: (photos: UploadedPhoto[]) => void;
  existingPhotos?: UploadedPhoto[];
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (existingPhotos.length > 0) {
      setPhotos(existingPhotos);
    }
  }, []);

  const updatePhotos = (newPhotos: UploadedPhoto[]) => {
    setPhotos(newPhotos);
    onUpload(newPhotos);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;

    const validFiles = Array.from(files).filter((file) => {
      if (!allowedTypes.includes(file.type)) {
        setError(`Unsupported file type: ${file.name}`);
        return false;
      }
      if (file.size > maxSize) {
        setError(`File too large: ${file.name} (Max: 5MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      const uploadedPhotos: UploadedPhoto[] = [];

      for (const file of validFiles) {
        const fileName = `${uuidv4()}_${file.name}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("locations")
          .upload(filePath, file);

        if (uploadError) throw new Error(uploadError.message);

        const { data } = supabase.storage
          .from("locations")
          .getPublicUrl(filePath);

        if (!data.publicUrl) throw new Error("Failed to retrieve public URL");

        uploadedPhotos.push({ url: data.publicUrl, caption: "" });
      }

      updatePhotos([...photos, ...uploadedPhotos]);
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "An unknown error occurred"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files || files.length === 0) {
      setError("Please select at least one file.");
      return;
    }
    uploadFiles(files);
  };

  const handleAddUrl = () => {
    if (!imageUrl) return;
    try {
      new URL(imageUrl);
    } catch {
      setError("Invalid URL format.");
      return;
    }
    updatePhotos([...photos, { url: imageUrl, caption: "" }]);
    setImageUrl("");
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const updated = [...photos];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    updatePhotos(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = photos.findIndex((_, i) => `photo-${i}` === active.id);
      const newIndex = photos.findIndex((_, i) => `photo-${i}` === over?.id);
      updatePhotos(arrayMove(photos, oldIndex, newIndex));
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    updatePhotos(updated);
  };

  return (
    <div className="flex flex-col space-y-2">
      <label htmlFor="file-upload" className="cursor-pointer">
        Images
      </label>
      <div className="flex items-center gap-4">
        <div className="flex items-center pb-2">
          <label
            htmlFor="file-upload"
            className={buttonVariants({
              variant: "outline",
              className: `cursor-pointer flex items-center space-x-2 border p-2 rounded-md hover:bg-muted ${
                uploading ? "opacity-50 cursor-not-allowed" : ""
              }`,
            })}
          >
            {uploading ? "Uploading..." : "Upload Images"}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            disabled={uploading}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 pb-2">
        <Input
          type="url"
          placeholder="Enter Image URL (e.g., Unsplash)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full"
        />
        <Button onClick={handleAddUrl} disabled={!imageUrl.trim()}>
          Add
        </Button>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={photos.map((_, i) => `photo-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-4">
              {photos.map((photo, index) => (
                <SortablePhoto
                  key={`photo-${
                    // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                    index
                  }`}
                  id={`photo-${index}`}
                  index={index}
                  photo={photo}
                  onRemove={() => removePhoto(index)}
                  onMoveUp={() => movePhoto(index, index - 1)}
                  onMoveDown={() => movePhoto(index, index + 1)}
                  onCaptionChange={(caption) => {
                    const updated = [...photos];
                    updated[index].caption = caption;
                    updatePhotos(updated);
                  }}
                  isFirst={index === 0}
                  isLast={index === photos.length - 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default ImageUploader;
