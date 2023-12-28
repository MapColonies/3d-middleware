import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { Layer3DMetadata } from '@map-colonies/mc-model-types';

export interface StoreTriggerResponse {
  jobID: string;
  status: OperationStatus.IN_PROGRESS;
}

export interface StoreTriggerConfig {
  url: string;
}

export interface DeleteRequest {
  modelId: string;
  modelLink: string;
}

export interface StoreTriggerPayload {
  modelId: string;
  pathToTileset: string;
  tilesetFilename: string;
  metadata: Layer3DMetadata;
}
