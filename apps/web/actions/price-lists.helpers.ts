import { supabaseAdmin } from '@/lib/db/client';

type PriceListUpdateAuditInput = {
  priceListId: string;
  actorId: string;
  existingPriceList: any;
  updatedPriceList: any;
  updateInput: {
    name?: string;
    status?: string;
    default_margin_percent?: number;
    rules?: any[];
  };
};

export async function logPriceListEvent(
  eventType: string,
  priceListId: string,
  actorId: string,
  message?: string,
  oldValue?: any,
  newValue?: any,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabaseAdmin.rpc('log_price_list_event', {
      p_event_type: eventType,
      p_price_list_id: priceListId,
      p_actor_id: actorId,
      p_message: message,
      p_old_value: oldValue ? JSON.stringify(oldValue) : null,
      p_new_value: newValue ? JSON.stringify(newValue) : null,
      p_metadata: metadata || {},
      p_severity: 'info',
    });
  } catch (error) {
    // Non bloccare l'operazione se il logging fallisce.
    console.error('Errore logging evento listino:', error);
  }
}

export async function logUpdatePriceListAuditEvents({
  priceListId,
  actorId,
  existingPriceList,
  updatedPriceList,
  updateInput,
}: PriceListUpdateAuditInput): Promise<void> {
  const changes: Record<string, any> = {};

  if (updateInput.name && updateInput.name !== existingPriceList.name) {
    changes.name = { from: existingPriceList.name, to: updateInput.name };
  }

  if (updateInput.status && updateInput.status !== existingPriceList.status) {
    changes.status = { from: existingPriceList.status, to: updateInput.status };
    if (updateInput.status === 'active' && existingPriceList.status !== 'active') {
      await logPriceListEvent(
        'price_list_activated',
        priceListId,
        actorId,
        `Listino attivato: ${updatedPriceList.name || existingPriceList.name}`
      );
    } else if (updateInput.status === 'archived' && existingPriceList.status !== 'archived') {
      await logPriceListEvent(
        'price_list_archived',
        priceListId,
        actorId,
        `Listino archiviato: ${updatedPriceList.name || existingPriceList.name}`
      );
    }
  }

  if (
    updateInput.default_margin_percent !== undefined &&
    updateInput.default_margin_percent !== existingPriceList.default_margin_percent
  ) {
    changes.default_margin_percent = {
      from: existingPriceList.default_margin_percent,
      to: updateInput.default_margin_percent,
    };
    await logPriceListEvent(
      'price_list_margin_updated',
      priceListId,
      actorId,
      `Margine aggiornato: ${existingPriceList.default_margin_percent}% -> ${updateInput.default_margin_percent}%`,
      { default_margin_percent: existingPriceList.default_margin_percent },
      { default_margin_percent: updateInput.default_margin_percent }
    );
  }

  if (updateInput.rules !== undefined) {
    const oldRulesCount = (existingPriceList.rules as any[])?.length || 0;
    const newRulesCount = (updateInput.rules as any[])?.length || 0;
    changes.rules = { from: oldRulesCount, to: newRulesCount };

    if (newRulesCount > oldRulesCount) {
      await logPriceListEvent(
        'price_list_rule_created',
        priceListId,
        actorId,
        `Regola creata: ${newRulesCount - oldRulesCount} nuova/e`,
        { rules_count: oldRulesCount },
        { rules_count: newRulesCount }
      );
    } else if (newRulesCount < oldRulesCount) {
      await logPriceListEvent(
        'price_list_rule_deleted',
        priceListId,
        actorId,
        `Regola eliminata: ${oldRulesCount - newRulesCount} rimossa/e`,
        { rules_count: oldRulesCount },
        { rules_count: newRulesCount }
      );
    } else {
      await logPriceListEvent(
        'price_list_rule_updated',
        priceListId,
        actorId,
        `Regole modificate: ${newRulesCount} regole`,
        { rules_count: oldRulesCount },
        { rules_count: newRulesCount }
      );
    }
  }

  if (Object.keys(changes).length > 0) {
    await logPriceListEvent(
      'price_list_updated',
      priceListId,
      actorId,
      `Listino aggiornato: ${Object.keys(changes).join(', ')}`,
      existingPriceList,
      updatedPriceList
    );
  }
}

export async function enrichPriceListsWithCourierData(priceLists: any[]): Promise<void> {
  if (!priceLists.length) return;

  const courierIds = [
    ...new Set(
      priceLists
        .map((priceList: any) => priceList.courier_id)
        .filter((courierId: string | null) => courierId !== null)
    ),
  ];

  if (courierIds.length === 0) return;

  const { data: couriers } = await supabaseAdmin
    .from('couriers')
    .select('id, code, name')
    .in('id', courierIds);

  const courierMap = new Map(couriers?.map((courier) => [courier.id, courier]) || []);
  priceLists.forEach((priceList: any) => {
    if (priceList.courier_id && courierMap.has(priceList.courier_id)) {
      priceList.courier = courierMap.get(priceList.courier_id);
    }
  });
}

export async function enrichPriceListsWithCourierName(priceLists: any[]): Promise<any[]> {
  if (!priceLists.length) return priceLists;

  const courierIds = [
    ...new Set(priceLists.map((priceList: any) => priceList.courier_id).filter(Boolean)),
  ];
  if (courierIds.length === 0) return priceLists;

  const { data: couriers } = await supabaseAdmin
    .from('couriers')
    .select('id, display_name, name')
    .in('id', courierIds);

  if (!couriers) return priceLists;

  const courierMap = new Map(
    couriers.map((courier: any) => [courier.id, courier.display_name || courier.name])
  );

  return priceLists.map((priceList: any) => ({
    ...priceList,
    courier_name: priceList.courier_id ? courierMap.get(priceList.courier_id) || null : null,
  }));
}
