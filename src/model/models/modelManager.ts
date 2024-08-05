import { inject, injectable } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { StatusCodes } from 'http-status-codes';
import { StoreTriggerCall } from '../../externalServices/storeTrigger/storeTriggerCall';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { SERVICES } from '../../common/constants';
import { ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { IngestionPayload, IngestionSourcesPayload, LogContext, ValidationResponse } from '../../common/interfaces';
import { convertStringToGeojson, changeBasePathToPVPath, replaceBackQuotesWithQuotes, removePvPathFromModelPath } from './utilities';

@injectable()
export class ModelManager {
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(ValidationManager) private readonly validator: ValidationManager,
    @inject(StoreTriggerCall) private readonly storeTrigger: StoreTriggerCall
  ) {
    this.logContext = {
      fileName: __filename,
      class: ModelManager.name,
    };
  }

  @withSpanAsyncV4
  public async validateModelSources(payload: IngestionSourcesPayload): Promise<ValidationResponse> {
    const logContext = { ...this.logContext, function: this.validateModelSources.name };
    this.logger.info({
      msg: 'Sources validation started',
      logContext,
      payload,
    });

    const resultModelPathValidation = this.validator.validateModelPath(payload.modelPath);
    if (typeof resultModelPathValidation === 'string') {
      return {
        isValid: false,
        message: resultModelPathValidation,
      };
    }
    payload.modelPath = this.getAdjustedModelPath(payload.modelPath);
    const sourcesValidationResponse = await this.validator.sourcesValid(payload);

    this.logger.info({
      msg: 'Sources validation ended',
      logContext,
      payload,
      sourcesValidationResponse,
    });
    return sourcesValidationResponse;
  }

  // @withSpanAsyncV4
  // public async validateModel(payload: IngestionPayload): Promise<ValidationResponse> {
  //   const logContext = { ...this.logContext, function: this.validateModel.name };
  //   this.logger.info({
  //     msg: 'start validation of new model',
  //     logContext,
  //     modelName: payload.metadata.productName,
  //     payload,
  //   });
  //   throw new NotImplementedError('Not implemented yet');
  // }

  @withSpanAsyncV4
  public async createModel(payload: IngestionPayload): Promise<StoreTriggerResponse> {
    const logContext = { ...this.logContext, function: this.createModel.name };
    const modelId = uuid();
    this.logger.info({
      msg: 'started ingestion of new model',
      logContext,
      modelId,
      modelName: payload.metadata.productName,
      payload,
    });
    const spanActive = trace.getActiveSpan();

    spanActive?.setAttributes({
      [THREE_D_CONVENTIONS.three_d.catalogManager.catalogId]: modelId,
    });

    const originalModelPath: string = payload.modelPath;
    payload.metadata.footprint = convertStringToGeojson(JSON.stringify(payload.metadata.footprint));

    this.logger.debug({
      msg: 'starting validating the payload',
      logContext,
      modelId,
      modelName: payload.metadata.productName,
    });
    try {
      const resultModelPathValidation = this.validator.validateModelPath(payload.modelPath);
      if (typeof resultModelPathValidation === 'string') {
        throw new AppError('', StatusCodes.BAD_REQUEST, resultModelPathValidation, true);
      }
      payload.modelPath = this.getAdjustedModelPath(payload.modelPath);

      const validated: boolean | string = await this.validator.validateIngestion(payload);
      if (typeof validated == 'string') {
        throw new AppError('badRequest', StatusCodes.BAD_REQUEST, validated, true);
      }
      this.logger.info({
        msg: 'model validated successfully',
        logContext,
        modelId,
        modelName: payload.metadata.productName,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({
        msg: 'unfamiliar error',
        logContext,
        error,
      });
      throw new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, String(error), true);
    }

    const request: StoreTriggerPayload = {
      modelId: modelId,
      pathToTileset: removePvPathFromModelPath(payload.modelPath),
      tilesetFilename: payload.tilesetFilename,
      metadata: { ...payload.metadata, productSource: originalModelPath },
    };
    try {
      const response: StoreTriggerResponse = await this.storeTrigger.postPayload(request);
      return response;
    } catch (error) {
      this.logger.error({
        msg: 'Error in creating a flow',
        logContext,
        modelId,
        modelName: payload.metadata.productName,
        error,
        payload,
      });
      throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'store-trigger service is not available', true);
    }
  }

  private getAdjustedModelPath(modelPath: string): string {
    const logContext = { ...this.logContext, function: this.getAdjustedModelPath.name };
    const changedModelPath = changeBasePathToPVPath(modelPath);
    const replacedModelPath = replaceBackQuotesWithQuotes(changedModelPath);
    this.logger.debug({
      msg: `changed model name from: '${modelPath}' to: '${replacedModelPath}'`,
      logContext,
      productSource: modelPath,
      replacedModelPath: replacedModelPath,
    });
    return replacedModelPath;
  }
}
