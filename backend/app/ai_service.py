import httpx
from typing import List, Optional, Dict
from app.config import settings
import json


class AIService:
    """AI服务 - 调用大模型API"""
    
    def __init__(self):
        self.api_key = settings.openai_api_key
        self.api_base = settings.openai_api_base
        self.model = settings.openai_model
        
        if not self.api_key:
            raise ValueError(
                "⚠️  未检测到API Key配置！请按以下步骤配置：\n"
                "1. 复制 backend/.env.example 为 backend/.env\n"
                "2. 编辑 .env 文件，设置 OPENAI_API_KEY=your_actual_api_key\n"
                "3. 重启后端服务\n\n"
                "如果您使用其他兼容OpenAI格式的API，请同时配置 OPENAI_API_BASE"
            )
    
    async def call_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """调用OpenAI兼容的聊天补全API"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.api_base}/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                error_detail = f"API调用失败: {e.response.status_code}"
                try:
                    error_body = e.response.json()
                    if "error" in error_body:
                        error_detail += f" - {error_body['error'].get('message', str(error_body['error']))}"
                    else:
                        error_detail += f" - {e.response.text}"
                except:
                    error_detail += f" - {e.response.text}"
                raise Exception(error_detail)
            except httpx.TimeoutException:
                raise Exception("API调用超时，请检查网络连接或API服务是否可用")
            except httpx.ConnectError as e:
                raise Exception(f"无法连接到API服务: {self.api_base}，请检查API地址是否正确")
            except Exception as e:
                if "API调用" in str(e) or "API服务" in str(e):
                    raise
                raise Exception(f"API调用异常: {str(e)}")
    
    async def call_vision_completion(
        self,
        text_content: str,
        image_base64: str,
        image_type: str = "jpeg",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """调用支持视觉的聊天补全API（用于图片识别）"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # 构建包含图片的消息
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": text_content
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/{image_type};base64,{image_base64}"
                        }
                    }
                ]
            }
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    f"{self.api_base}/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                error_detail = f"API调用失败: {e.response.status_code}"
                try:
                    error_body = e.response.json()
                    if "error" in error_body:
                        error_detail += f" - {error_body['error'].get('message', str(error_body['error']))}"
                    else:
                        error_detail += f" - {e.response.text}"
                except:
                    error_detail += f" - {e.response.text}"
                raise Exception(error_detail)
            except httpx.TimeoutException:
                raise Exception("API调用超时，请检查网络连接或API服务是否可用")
            except httpx.ConnectError as e:
                raise Exception(f"无法连接到API服务: {self.api_base}，请检查API地址是否正确")
            except Exception as e:
                if "API调用" in str(e) or "API服务" in str(e):
                    raise
                raise Exception(f"API调用异常: {str(e)}")
    
    async def generate_question(
        self,
        document_content: str,
        review_type: str,
        conversation_history: List[Dict] = None,
        dimensions_config: List[Dict] = None
    ) -> str:
        """生成AI提问 - 基于思考维度的整文档评审，生成多个结构化问题"""
        
        # 使用配置的思考维度，如果没有则使用默认维度
        if dimensions_config:
            dimensions_text = "\n".join([
                f"{i+1}. **{dim['name']}**：{dim['description']}"
                for i, dim in enumerate(dimensions_config)
            ])
            system_prompt = f"""你是一位资深的项目评审专家。你的任务是基于项目文档的全部内容，提出深入、有洞察力的问题。

请从以下思考维度进行评审和提问：
{dimensions_text}

提问要求：
- 基于文档的具体内容提出问题，不要泛泛而谈
- 生成3-5个关键问题，每个问题单独一行
- 问题要具体、有针对性，能够揭示项目潜在风险或机会
- 问题要适合在评审会上讨论，能够引导深入交流
- 每个问题前用数字编号（如"1. "、"2. "）"""
        elif review_type == "project_initiation":
            system_prompt = """你是一位资深的项目立项评审专家。你的任务是基于项目文档的全部内容，提出深入、有洞察力的问题。

请从以下思考维度进行评审和提问：
1. **市场机会与定位**：目标市场是否清晰？市场规模和增长潜力如何？竞争对手情况？
2. **技术可行性**：技术方案是否成熟？是否存在技术风险？研发周期是否合理？
3. **商业价值与盈利模式**：商业模式是否可行？收入来源是否清晰？盈利预期是否合理？
4. **资源需求与团队**：需要投入哪些资源？团队是否具备相应能力？是否有足够的人力支持？
5. **风险与挑战**：可能面临哪些风险？是否有应对预案？项目成败的关键因素是什么？

提问要求：
- 基于文档的具体内容提出问题，不要泛泛而谈
- 生成3-5个关键问题，每个问题单独一行
- 问题要具体、有针对性，能够揭示项目潜在风险或机会
- 问题要适合在评审会上讨论，能够引导深入交流
- 每个问题前用数字编号（如"1. "、"2. "）"""
        else:  # commercialization
            system_prompt = """你是一位资深的产品商业化评审专家。你的任务是基于项目文档的全部内容，提出深入、有洞察力的问题。

请从以下思考维度进行评审和提问：
1. **商业化策略**：商业化路径是否清晰？目标客户群体是谁？是否有明确的市场切入点？
2. **盈利模式**：收入来源是什么？定价策略是否合理？盈利周期预期多久？
3. **市场推广与销售**：如何获取客户？营销渠道是否有效？销售周期和成本如何？
4. **竞争分析**：竞争对手有哪些？差异化优势是什么？护城河在哪里？
5. **投资回报**：投入产出比如何？需要多长时间回本？规模化潜力如何？

提问要求：
- 基于文档的具体内容提出问题，不要泛泛而谈
- 生成3-5个关键问题，每个问题单独一行
- 问题要具体、有针对性，能够揭示商业风险或机会
- 问题要适合在评审会上讨论，能够引导深入交流
- 每个问题前用数字编号（如"1. "、"2. "）"""
        
        # 构建用户消息 - 基于文档全部内容
        user_message = f"""请仔细阅读以下项目文档的全部内容，结合评审思考维度，提出3-5个最关键的评审问题：

文档内容：
{document_content[:8000]}

请按编号列出问题："""
        
        # 构建消息列表
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史对话（避免重复提问）
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": user_message})
        
        # 调用API - 增加max_tokens以支持更长的问题列表
        return await self.call_chat_completion(messages, temperature=0.8, max_tokens=4000)
    
    async def generate_followup_question(
        self,
        document_content: str,
        review_type: str,
        question: str,
        answer: str,
        conversation_history: List[Dict] = None
    ) -> str:
        """根据回答生成追问"""
        
        # 构建系统提示
        if review_type == "project_initiation":
            system_prompt = """你是一位资深的项目立项评审专家。刚才你提出了一个问题，现在收到了对方的回答。

请基于对方的回答，提出一个深入的追问。要求：
- 追问要针对回答中的关键点或模糊之处
- 帮助深入挖掘项目细节
- 如果回答已经很清晰，可以提出一个新的相关问题
- 只提出一个追问，不要多个问题"""
        else:
            system_prompt = """你是一位资深的产品商业化评审专家。刚才你提出了一个问题，现在收到了对方的回答。

请基于对方的回答，提出一个深入的追问。要求：
- 追问要针对回答中的关键点或模糊之处
- 帮助深入挖掘商业化细节
- 如果回答已经很清晰，可以提出一个新的相关问题
- 只提出一个追问，不要多个问题"""
        
        user_message = f"""文档内容摘要：
{document_content[:2000]}

你提出的问题：
{question}

对方的回答：
{answer}

请提出你的追问："""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        # 添加历史对话
        if conversation_history:
            messages[1:1] = conversation_history
        
        return await self.call_chat_completion(messages, temperature=0.7)
    
    async def evaluate_judge_question(
        self,
        question_content: str,
        document_content: str,
        review_type: str
    ) -> Dict:
        """评价评委提问质量"""
        
        system_prompt = """你是一位专业的评审质量评估专家。请从以下三个维度对评委的提问进行评分（每项0-10分）：

1. 切题度：问题是否与评审文档内容相关
2. 深度：问题是否触及核心问题，是否具有深度
3. 启发性：问题是否能引发深入讨论

请以JSON格式返回评分结果，格式如下：
{
    "relevance": 分数,
    "depth": 分数,
    "inspiration": 分数,
    "total": 总分,
    "reasoning": "评分理由"
}"""
        
        user_message = f"""评审类型：{review_type}

文档内容：
{document_content[:2000]}

评委提问：
{question_content}

请对该提问进行评分。"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        result = await self.call_chat_completion(messages, temperature=0.5)
        
        # 解析JSON结果
        try:
            return json.loads(result)
        except:
            # 如果解析失败，返回默认评分
            return {
                "relevance": 5.0,
                "depth": 5.0,
                "inspiration": 5.0,
                "total": 5.0,
                "reasoning": result
            }
    
    async def generate_rating(
        self,
        document_content: str,
        qa_history: List[Dict],
        review_type: str,
        dimensions_config: List[Dict] = None
    ) -> Dict:
        """生成AI建议评分"""
        
        # 使用配置的评分维度，如果没有则使用默认维度
        if dimensions_config:
            dimensions_text = "\n".join([
                f"{i+1}. {dim['name']}（权重{dim['weight']}%）：{dim['description']}"
                for i, dim in enumerate(dimensions_config)
            ])
            
            # 构建动态JSON字段名
            field_names = [f"dim_{i+1}" for i in range(len(dimensions_config))]
            
            system_prompt = f"""你是一位专业的项目评审专家。请基于文档内容和问答记录，按照以下评分维度给出建议评分。

评分维度（每项0-10分）：
{dimensions_text}

请以JSON格式返回评分结果：
{{
    {", ".join([f'"{field}": 分数' for field in field_names])},
    "total": 总分,
    "reasoning": "评分理由"
}}"""
        else:
            # 默认评分维度（兼容旧逻辑）
            system_prompt = """你是一位专业的项目评审专家。请基于文档内容和问答记录，从AI视角给出建议评分。

评分维度（每项0-10分）：
1. 项目可行性
2. 市场前景
3. 技术创新性
4. 团队能力
5. 风险可控性

请以JSON格式返回评分结果：
{
    "feasibility": 分数,
    "market_prospect": 分数,
    "innovation": 分数,
    "team_capability": 分数,
    "risk_control": 分数,
    "total": 总分,
    "reasoning": "评分理由"
}"""
        
        # 构建问答历史摘要
        qa_summary = "\n".join([
            f"Q: {qa['question']}\nA: {qa.get('answer', '未回答')}"
            for qa in qa_history[:5]  # 只取前5轮问答
        ])
        
        user_message = f"""评审类型：{review_type}

文档摘要：
{document_content[:2000]}

问答记录：
{qa_summary}

请给出建议评分。"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        result = await self.call_chat_completion(messages, temperature=0.6)
        
        # 解析JSON结果
        try:
            # 清理可能的Markdown代码块格式
            cleaned_result = result.strip()
            if cleaned_result.startswith("```"):
                # 移除代码块标记
                lines = cleaned_result.split('\n')
                # 移除第一行 (```json 或 ```) 和最后一行 (```)
                cleaned_result = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            
            parsed = json.loads(cleaned_result)
            
            # 检查是否有嵌套的JSON结构（AI有时会把真实数据放在reasoning字段里）
            if isinstance(parsed.get("reasoning"), str) and parsed.get("reasoning", "").startswith("```"):
                # 尝试从reasoning字段提取真实的JSON
                nested_content = parsed["reasoning"].strip()
                if nested_content.startswith("```"):
                    nested_lines = nested_content.split('\n')
                    nested_json = '\n'.join(nested_lines[1:-1] if nested_lines[-1].strip() == '```' else nested_lines[1:])
                    try:
                        nested_parsed = json.loads(nested_json)
                        # 使用嵌套的数据覆盖当前数据
                        if "total" in nested_parsed:
                            parsed = nested_parsed
                    except:
                        pass
            # 如果使用配置维度，添加维度名称映射
            if dimensions_config:
                parsed["dimensions_meta"] = [
                    {"name": dim["name"], "weight": dim["weight"]}
                    for dim in dimensions_config
                ]
            return parsed
        except:
            # 返回默认值
            if dimensions_config:
                default_result = {
                    f"dim_{i+1}": 5.0
                    for i in range(len(dimensions_config))
                }
                default_result["total"] = 5.0
                default_result["reasoning"] = result
                default_result["dimensions_meta"] = [
                    {"name": dim["name"], "weight": dim["weight"]}
                    for dim in dimensions_config
                ]
                return default_result
            else:
                return {
                    "feasibility": 5.0,
                    "market_prospect": 5.0,
                    "innovation": 5.0,
                    "team_capability": 5.0,
                    "risk_control": 5.0,
                    "total": 5.0,
                    "reasoning": result
                }

    async def generate_product_questions(
        self,
        document_content: str,
        product_name: str,
        dimensions_config: List[Dict] = None,
        image_base64: str = None,
        image_type: str = None
    ) -> List[str]:
        """为待发布产品评审生成AI提问 - 支持文本和图片，使用可配置维度"""
        
        # 使用配置的维度，如果没有则使用默认维度
        if dimensions_config:
            dimensions_text = "\n".join([
                f"{i+1}. **{dim['name']}**：{dim.get('description', '')}"
                for i, dim in enumerate(dimensions_config)
            ])
            system_prompt = f"""# Role: 资深 AI 产品战略评审专家

## Profile
你是一位拥有 10 年以上经验的资深 AI 产品战略评审专家。你的工作对象是即将发布的 AI 商业化应用或内部产品。由于产品已进入待发布状态，你无需再质疑产品的基础合理性，而是作为"战略顾问"和"增长推手"，重点评估其未来的市场天花板、迭代规划、功能拓展潜力以及竞争壁垒。

## Task
请仔细阅读用户提供的【待发布产品介绍材料】（可能是文本或图片），生成 3-5 个具有战略洞察力的关键问题。这些问题应该帮助评估以下维度：

{dimensions_text}

## Rules
1. 问题应该犀利、具体，能直击产品核心
2. 每个问题都应该有明确的指向性，而非泛泛而谈
3. 问题应该基于产品介绍材料中的具体内容提出
4. 每个问题应该对应上述某个评估维度
5. 直接输出问题列表，每行一个问题，不需要编号或其他格式"""
        else:
            system_prompt = """# Role: 资深 AI 产品战略评审专家

## Profile
你是一位拥有 10 年以上经验的资深 AI 产品战略评审专家。你的工作对象是即将发布的 AI 商业化应用或内部产品。由于产品已进入待发布状态，你无需再质疑产品的基础合理性，而是作为"战略顾问"和"增长推手"，重点评估其未来的市场天花板、迭代规划、功能拓展潜力以及竞争壁垒。

## Task
请仔细阅读用户提供的【待发布产品介绍材料】（可能是文本或图片），生成 3-5 个具有战略洞察力的关键问题。这些问题应该帮助评估：
1. 市场空间与发展前景
2. 未来迭代方向规划
3. 核心功能拓展建议
4. 竞争壁垒与差异化

## Rules
1. 问题应该犀利、具体，能直击产品核心
2. 每个问题都应该有明确的指向性，而非泛泛而谈
3. 问题应该基于产品介绍材料中的具体内容提出
4. 直接输出问题列表，每行一个问题，不需要编号或其他格式"""

        user_text = f"""产品名称：{product_name}

请生成 3-5 个关键评审问题："""

        # 如果有图片，使用视觉模型
        if image_base64:
            result = await self.call_vision_completion(
                text_content=user_text,
                image_base64=image_base64,
                image_type=image_type or "jpeg",
                temperature=0.8,
                max_tokens=2000
            )
        else:
            user_message = f"""产品名称：{product_name}

产品介绍材料：
{document_content[:4000]}

请生成 3-5 个关键评审问题："""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            result = await self.call_chat_completion(messages, temperature=0.8, max_tokens=2000)
        
        # 解析问题列表
        questions = []
        for line in result.strip().split('\n'):
            line = line.strip()
            # 移除可能的编号
            if line and len(line) > 10:
                # 移除 "1."、"1、"等编号
                if line[0].isdigit():
                    for i, char in enumerate(line):
                        if char in '、.．:：':
                            line = line[i+1:].strip()
                            break
                questions.append(line)
        
        return questions[:5]  # 最多返回5个问题

    async def generate_product_rating(
        self,
        document_content: str,
        product_name: str,
        qa_history: List[Dict],
        dimensions_config: List[Dict] = None,
        image_base64: str = None,
        image_type: str = None
    ) -> Dict:
        """为待发布产品生成AI评价 - 支持文本和图片，使用可配置维度"""
        
        # 使用配置的维度，如果没有则使用默认维度
        if dimensions_config:
            dimensions_text = "\n".join([
                f"{i+1}. {dim['name']}\n   - {dim.get('criteria', dim.get('description', ''))}"
                for i, dim in enumerate(dimensions_config)
            ])
            # 生成 radar_data 的键名
            radar_keys = [dim.get('key', f"dimension_{i+1}") for i, dim in enumerate(dimensions_config)]
            
            system_prompt = f"""# Role: 资深 AI 产品战略评审专家

## Profile
你是一位拥有 10 年以上经验的资深 AI 产品战略评审专家。你的工作对象是即将发布的 AI 商业化应用或内部产品。由于产品已进入待发布状态，你无需再质疑产品的基础合理性，而是作为"战略顾问"和"增长推手"，重点评估其未来的市场天花板、迭代规划、功能拓展潜力以及竞争壁垒。

## Task
请仔细阅读用户提供的【待发布产品介绍材料】，严格按照以下维度进行深度分析，并输出结构化的评审报告。

## Evaluation Dimensions (评分标准)
请对以下维度进行独立评分（满分 100 分），并给出打分理由：

{dimensions_text}

## Output Format
请严格按照以下JSON格式输出评审报告：

{{
  "radar_data": {{
    "{radar_keys[0] if radar_keys else 'dimension_1'}": 分数,
    // 其他维度分数...
  }},
  "analysis": [
    {{
      "dimension": "维度名称",
      "score": 分数,
      "highlights": "核心亮点",
      "risks": "潜在风险/不足",
      "reasoning": "打分依据"
    }},
    // 其他维度分析...
  ],
  "suggestions": [
    "战略建议1",
    "战略建议2",
    "战略建议3"
  ]
}}

## Rules
1. 保持客观、犀利、建设性的语气，不要一味夸赞。
2. 所有的评分和建议必须基于材料中提供的信息，若材料缺失关键信息，请在打分依据中指出，并给予相应的低分。
3. 建议必须具备可执行性，拒绝"提高用户体验"、"加强推广"等空泛的废话。"""
        else:
            system_prompt = """# Role: 资深 AI 产品战略评审专家

## Profile
你是一位拥有 10 年以上经验的资深 AI 产品战略评审专家。你的工作对象是即将发布的 AI 商业化应用或内部产品。由于产品已进入待发布状态，你无需再质疑产品的基础合理性，而是作为"战略顾问"和"增长推手"，重点评估其未来的市场天花板、迭代规划、功能拓展潜力以及竞争壁垒。

## Task
请仔细阅读用户提供的【待发布产品介绍材料】，严格按照以下 4 个核心维度进行深度分析，并输出结构化的评审报告。

## Evaluation Dimensions (评分标准)
请对以下 4 个维度进行独立评分（满分 100 分），并给出打分理由：

1. 市场空间与发展前景 (Market Potential)
   - 90-100分：切中蓝海或高频刚需痛点；目标用户画像极其清晰；有清晰的规模化路径和爆发潜力。
   - 70-89分：市场需求存在，但竞争激烈或天花板可见；目标用户有一定规模，但转化路径较长。
   - 70分以下：伪需求或极小众需求；市场规模极小，难以支撑长期商业化发展。

2. 未来迭代方向规划 (Future Roadmap)
   - 90-100分：有明确的短期（3-6个月）与中长期（1年+）规划；迭代方向紧扣核心业务壁垒（如数据飞轮、生态拓展）；具备极强的可执行性。
   - 70-89分：有初步的迭代设想，但缺乏优先级排序；部分规划过于理想化，依赖外部不确定因素。
   - 70分以下：走一步看一步，无清晰路线图；或迭代方向偏离了产品的核心价值。

3. 核心功能拓展建议 (Feature Expansion)
   - 90-100分：核心功能闭环完整；已规划出能显著提升用户粘性或客单价的"杀手级"拓展功能；功能拓展与 AI 能力深度结合。
   - 70-89分：基础功能可用，但缺乏亮点；拓展功能多为常规需求，缺乏想象力。
   - 70分以下：核心功能存在明显断层；拓展功能与产品定位不符，或纯为堆砌 AI 功能。

4. 竞争壁垒与差异化 (Competitive Moat)
   - 90-100分：拥有独家数据、特定场景 Know-how 或极高的切换成本；差异化定位极其鲜明，竞品难以短期复制。
   - 70-89分：有一定先发优势或体验差异，但护城河较浅，容易被大厂或竞品通过资源投入抹平。
   - 70分以下：同质化严重，完全依赖通用大模型能力，无核心壁垒。

## Output Format
请严格按照以下JSON格式输出评审报告：

{
  "radar_data": {
    "market_potential": 分数,
    "future_roadmap": 分数,
    "feature_expansion": 分数,
    "competitive_moat": 分数
  },
  "analysis": [
    {
      "dimension": "市场空间与发展前景",
      "score": 分数,
      "highlights": "核心亮点",
      "risks": "潜在风险/不足",
      "reasoning": "打分依据"
    },
    // 其他3个维度...
  ],
  "suggestions": [
    "战略建议1",
    "战略建议2",
    "战略建议3"
  ]
}

## Rules
1. 保持客观、犀利、建设性的语气，不要一味夸赞。
2. 所有的评分和建议必须基于材料中提供的信息，若材料缺失关键信息，请在打分依据中指出，并给予相应的低分。
3. 建议必须具备可执行性，拒绝"提高用户体验"、"加强推广"等空泛的废话。"""

        # 构建问答历史摘要
        qa_summary = "\n".join([
            f"Q: {qa['question']}\nA: {qa.get('answer', '未回答')}"
            for qa in qa_history[:5]
        ])

        # 如果有图片，使用视觉模型
        if image_base64:
            user_text = f"""产品名称：{product_name}

问答记录：
{qa_summary}

请输出评审报告："""
            result = await self.call_vision_completion(
                text_content=user_text,
                image_base64=image_base64,
                image_type=image_type or "jpeg",
                temperature=0.6,
                max_tokens=4000
            )
        else:
            user_message = f"""产品名称：{product_name}

产品介绍材料：
{document_content[:4000]}

问答记录：
{qa_summary}

请输出评审报告："""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            result = await self.call_chat_completion(messages, temperature=0.6, max_tokens=4000)
        
        # 解析JSON结果
        try:
            # 清理可能的Markdown代码块格式
            cleaned_result = result.strip()
            if cleaned_result.startswith("```"):
                lines = cleaned_result.split('\n')
                cleaned_result = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            
            parsed = json.loads(cleaned_result)
            return parsed
        except:
            # 返回默认值
            return {
                "radar_data": {
                    "market_potential": 70,
                    "future_roadmap": 70,
                    "feature_expansion": 70,
                    "competitive_moat": 70
                },
                "analysis": [
                    {
                        "dimension": "市场空间与发展前景",
                        "score": 70,
                        "highlights": "无法评估",
                        "risks": "AI解析失败，请重新生成",
                        "reasoning": result
                    }
                ],
                "suggestions": ["请重新生成评价"]
            }


# 创建全局AI服务实例
ai_service = None

def get_ai_service():
    """获取AI服务实例"""
    global ai_service
    if ai_service is None:
        ai_service = AIService()
    return ai_service